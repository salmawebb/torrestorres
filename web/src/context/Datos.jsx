import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '../lib/api'
import { crearDatosIniciales, nuevoToken, SUCURSALES } from '../data/mock'
import { REGLAS_INICIALES, resumenCliente } from '../lib/lealtad'
import { modoDemo } from '../lib/supabase'
import { useSesion } from './Sesion'

const DatosContext = createContext(null)

export function DatosProvider({ children }) {
  return modoDemo ? <DatosDemo>{children}</DatosDemo> : <DatosSupabase>{children}</DatosSupabase>
}

function useResumenes(clientes, compras, canjes, reglas) {
  return useMemo(() => {
    const porCliente = (lista) => {
      const m = {}
      for (const v of lista) (m[v.clienteId] ??= []).push(v)
      return m
    }
    const compras_ = porCliente(compras)
    const canjes_ = porCliente(canjes)
    const r = {}
    for (const c of clientes) r[c.id] = resumenCliente(compras_[c.id] ?? [], canjes_[c.id] ?? [], reglas)
    return r
  }, [clientes, compras, canjes, reglas])
}

// Modo demo: almacén en memoria con datos de ejemplo.
function DatosDemo({ children }) {
  const [datos, setDatos] = useState(crearDatosIniciales)
  const [reglas, setReglas] = useState(REGLAS_INICIALES)
  const resumenes = useResumenes(datos.clientes, datos.compras, datos.canjes, reglas)

  const acciones = useMemo(
    () => ({
      agregarCliente(cliente, usuarioId) {
        const nuevo = {
          ...cliente,
          id: Math.max(...datos.clientes.map((c) => c.id)) + 1,
          registro: new Date(),
          registradoPor: usuarioId,
          token: nuevoToken(),
        }
        setDatos((d) => ({ ...d, clientes: [...d.clientes, nuevo] }))
        return nuevo
      },
      agregarCompra(compra) {
        const nueva = { ...compra, id: `v${Date.now()}`, cancelada: false }
        delete nueva.archivo
        setDatos((d) => ({ ...d, compras: [...d.compras, nueva] }))
        return nueva
      },
      cancelarCompra(id) {
        setDatos((d) => ({ ...d, compras: d.compras.map((c) => (c.id === id ? { ...c, cancelada: true } : c)) }))
      },
      agregarCanje(canje) {
        setDatos((d) => ({ ...d, canjes: [...d.canjes, { ...canje, id: `c${Date.now()}` }] }))
      },
      regenerarToken(clienteId) {
        setDatos((d) => ({
          ...d,
          clientes: d.clientes.map((c) => (c.id === clienteId ? { ...c, token: nuevoToken() } : c)),
        }))
      },
      crearCuenta(cuenta) {
        setDatos((d) => ({ ...d, usuarios: [...d.usuarios, { ...cuenta, id: `u${Date.now()}`, activa: true }] }))
      },
      cambiarActiva(id, activa) {
        setDatos((d) => ({ ...d, usuarios: d.usuarios.map((u) => (u.id === id ? { ...u, activa } : u)) }))
      },
      enviarRecuperacion() {},
      guardarReglas: setReglas,
    }),
    [datos.clientes],
  )

  const valor = useMemo(
    () => ({ ...datos, sucursales: SUCURSALES, reglas, resumenes, cargando: false, error: null, ...acciones }),
    [datos, reglas, resumenes, acciones],
  )
  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>
}

const VACIO = { clientes: [], compras: [], canjes: [] }

// Modo real: los datos vienen de Supabase y cada cambio se guarda ahí.
function DatosSupabase({ children }) {
  const { usuario } = useSesion()
  const [cat, setCat] = useState(null)
  const [datos, setDatos] = useState(VACIO)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const reglas = cat?.reglas ?? REGLAS_INICIALES
  const resumenes = useResumenes(datos.clientes, datos.compras, datos.canjes, reglas)

  const cargar = useCallback(async () => {
    try {
      const catalogos = await api.cargarCatalogos()
      const [clientes, movimientos] = await Promise.all([api.cargarClientes(), api.cargarMovimientos(catalogos)])
      setCat(catalogos)
      setDatos({ clientes, ...movimientos })
      setError(null)
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    if (!usuario) {
      setCat(null)
      setDatos(VACIO)
      return
    }
    setCargando(true)
    cargar().finally(() => setCargando(false))
    // Al volver a la pestaña se traen las ventas que registraron las demás.
    const alVolver = () => document.visibilityState === 'visible' && cargar()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [usuario, cargar])

  // Trae de nuevo las compras y canjes de un cliente (la base recalcula sus puntos).
  const refrescarCliente = useCallback(
    async (clienteId) => {
      const m = await api.cargarMovimientos(cat, clienteId)
      setDatos((d) => ({
        ...d,
        compras: [...d.compras.filter((v) => v.clienteId !== clienteId), ...m.compras],
        canjes: [...d.canjes.filter((v) => v.clienteId !== clienteId), ...m.canjes],
      }))
      return m
    },
    [cat],
  )

  const acciones = useMemo(
    () => ({
      async agregarCliente(cliente) {
        const nuevo = await api.insertarCliente(cliente)
        setDatos((d) => ({ ...d, clientes: [...d.clientes, nuevo] }))
        return nuevo
      },
      async agregarCompra(compra) {
        const id = await api.insertarCompra(cat, compra)
        const m = await refrescarCliente(compra.clienteId)
        return m.compras.find((v) => v.id === id)
      },
      async cancelarCompra(id) {
        await api.cancelarCompra(id)
        const compra = datos.compras.find((v) => v.id === id)
        if (compra) await refrescarCliente(compra.clienteId)
      },
      async agregarCanje(canje) {
        await api.insertarCanje(cat, canje)
        await refrescarCliente(canje.clienteId)
      },
      async regenerarToken(clienteId) {
        const token = await api.regenerarToken(clienteId)
        setDatos((d) => ({ ...d, clientes: d.clientes.map((c) => (c.id === clienteId ? { ...c, token } : c)) }))
      },
      async crearCuenta(cuenta) {
        await api.crearCuenta(cuenta)
        setCat(await api.cargarCatalogos())
      },
      async cambiarActiva(id, activa) {
        await api.cambiarActiva(id, activa)
        setCat(await api.cargarCatalogos())
      },
      enviarRecuperacion: api.enviarRecuperacion,
      async guardarReglas(r) {
        await api.guardarReglas(r)
        setCat(await api.cargarCatalogos())
      },
    }),
    [cat, datos.compras, refrescarCliente],
  )

  const valor = useMemo(
    () => ({
      ...datos,
      usuarios: cat?.usuarios ?? [],
      sucursales: cat?.sucursales.filter((s) => s.activa).map((s) => s.nombre) ?? [],
      reglas,
      resumenes,
      cargando: cargando || (!!usuario && !cat && !error),
      error,
      ...acciones,
    }),
    [datos, cat, reglas, resumenes, cargando, usuario, error, acciones],
  )
  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDatos = () => useContext(DatosContext)
