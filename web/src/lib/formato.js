export const pesos = (n) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: n % 1 ? 2 : 0 })

export const fecha = (d) => (d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

export const hora = (d) => d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

export const telefono = (t) => (t?.length === 12 ? `${t.slice(2, 4)} ${t.slice(4, 8)} ${t.slice(8)}` : t)

// Normaliza a lada de país 52 sin espacios, como pide el documento.
export const normalizarTelefono = (t) => {
  const digitos = t.replace(/\D/g, '')
  if (digitos.length === 10) return `52${digitos}`
  return digitos
}

export const inicioDelDia = (d = new Date()) => {
  const f = new Date(d)
  f.setHours(0, 0, 0, 0)
  return f
}

// Semana de lunes a domingo.
export const inicioDeSemana = (d = new Date()) => {
  const f = inicioDelDia(d)
  const dia = (f.getDay() + 6) % 7
  f.setDate(f.getDate() - dia)
  return f
}

export const sumarDias = (d, n) => {
  const f = new Date(d)
  f.setDate(f.getDate() + n)
  return f
}

// "dd/mm" cae entre hoy y los próximos 7 días.
export const cumpleEnSemana = (ddmm, hoy = new Date()) => {
  const [d, m] = ddmm.split('/').map(Number)
  const base = inicioDelDia(hoy)
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(base, i)
    if (f.getDate() === d && f.getMonth() + 1 === m) return f
  }
  return null
}
