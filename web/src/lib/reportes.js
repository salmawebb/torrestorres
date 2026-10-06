import { sumarDias } from './formato'

export function ranking(compras, usuarios, desde, hasta, sucursal = 'Todas') {
  return usuarios
    .filter((u) => u.rol === 'empleada')
    .map((u) => {
      const suyas = compras.filter(
        (v) => !v.cancelada && v.empleadaId === u.id && v.fecha >= desde && v.fecha < hasta && (sucursal === 'Todas' || v.sucursal === sucursal),
      )
      return { usuario: u, total: suyas.reduce((s, v) => s + v.total, 0), ventas: suyas.length }
    })
    .filter((f) => f.usuario.activa || f.ventas > 0)
}

export function porVencer(clientes, resumenes, dias = 30, hoy = new Date()) {
  const limite = sumarDias(hoy, dias)
  return clientes
    .filter((c) => resumenes[c.id].vigencia && resumenes[c.id].vigencia <= limite)
    .sort((a, b) => resumenes[a.id].vigencia - resumenes[b.id].vigencia)
}

export function cercaDeSubir(clientes, resumenes, margen = 500) {
  return clientes
    .filter((c) => resumenes[c.id].siguienteNivel && resumenes[c.id].faltaParaSiguiente <= margen)
    .sort((a, b) => resumenes[a.id].faltaParaSiguiente - resumenes[b.id].faltaParaSiguiente)
}

// Mismo número de ticket en la misma sucursal.
export function duplicados(compras) {
  const vistos = {}
  const dup = []
  for (const v of compras.filter((x) => !x.cancelada)) {
    const k = `${v.sucursal}-${v.ticket}`
    if (vistos[k]) dup.push([vistos[k], v])
    else vistos[k] = v
  }
  return dup
}
