import { createContext, useContext, useMemo, useState } from 'react'
import { crearDatosIniciales, nuevoToken } from '../data/mock'
import { REGLAS_INICIALES, resumenCliente } from '../lib/lealtad'

const DatosContext = createContext(null)

// Almacén en memoria que imita lo que hará Supabase.
export function DatosProvider({ children }) {
  const [datos, setDatos] = useState(crearDatosIniciales)
  const [reglas, setReglas] = useState(REGLAS_INICIALES)

  const resumenes = useMemo(() => {
    const r = {}
    for (const c of datos.clientes) {
      r[c.id] = resumenCliente(
        datos.compras.filter((v) => v.clienteId === c.id),
        datos.canjes.filter((v) => v.clienteId === c.id),
        reglas,
      )
    }
    return r
  }, [datos, reglas])

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
      actualizarUsuarios(usuarios) {
        setDatos((d) => ({ ...d, usuarios }))
      },
      setReglas,
    }),
    [datos.clientes],
  )

  const valor = useMemo(() => ({ ...datos, reglas, resumenes, ...acciones }), [datos, reglas, resumenes, acciones])
  return <DatosContext.Provider value={valor}>{children}</DatosContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDatos = () => useContext(DatosContext)
