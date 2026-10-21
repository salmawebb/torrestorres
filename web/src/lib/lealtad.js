// Reglas del programa de lealtad (documento "Sistema de ventas y lealtad").
// En la versión final estas reglas vendrán de la tabla de configuración;
// aquí son los valores iniciales que maneja el negocio.

export const REGLAS_INICIALES = {
  bloquePesos: 10, // puntos por cada $10
  valorPunto: 0.25, // $ por punto al canjear
  minimoCanje: 200, // puntos mínimos para canjear
  vigenciaMeses: 6,
  niveles: [
    { nombre: 'Plata', desde: 0, puntosPorBloque: 1, beneficio: 'Acceso al programa y acumulación de puntos' },
    { nombre: 'Oro', desde: 2000, puntosPorBloque: 2, beneficio: 'Doble puntos, limpieza gratis y promociones especiales' },
    { nombre: 'Diamante', desde: 5000, puntosPorBloque: 2, beneficio: 'Doble puntos, limpieza gratis, regalo de cumpleaños y beneficios exclusivos' },
  ],
}

export function sumarMeses(fecha, meses) {
  const d = new Date(fecha)
  d.setMonth(d.getMonth() + meses)
  return d
}

// Puntos de una compra: total entre el bloque, redondeado, por los puntos del nivel
// que el cliente tenía ANTES de la compra. Ejemplo: $308 en Plata = 31 puntos.
export function puntosPorCompra(total, indiceNivel, reglas = REGLAS_INICIALES) {
  const nivel = reglas.niveles[indiceNivel]
  return Math.round(total / reglas.bloquePesos) * nivel.puntosPorBloque
}

// Resume a un cliente a partir de sus compras y canjes, aplicando:
// - sube un nivel por compra como máximo, sin saltarse ninguno;
// - si pasan 6 meses sin comprar, los puntos vencen y baja un solo nivel,
//   con el acumulado reiniciado en el mínimo del nivel al que bajó.
export function resumenCliente(compras, canjes, reglas = REGLAS_INICIALES, hoy = new Date()) {
  const activas = compras.filter((c) => !c.cancelada).sort((a, b) => a.fecha - b.fecha)
  const eventos = [
    ...activas.map((c) => ({ tipo: 'compra', fecha: c.fecha, dato: c })),
    ...canjes.map((c) => ({ tipo: 'canje', fecha: c.fecha, dato: c })),
  ].sort((a, b) => a.fecha - b.fecha)

  let nivel = 0
  let acumulado = 0
  let puntos = 0
  let ultimaCompra = null
  const puntosPorCompraId = {}

  const aplicarVencimiento = (hasta) => {
    if (ultimaCompra && sumarMeses(ultimaCompra, reglas.vigenciaMeses) <= hasta && puntos + acumulado > 0) {
      puntos = 0
      if (nivel > 0) {
        nivel -= 1
        acumulado = reglas.niveles[nivel].desde
      }
      ultimaCompra = null // baja solo la primera vez
    }
  }

  for (const e of eventos) {
    aplicarVencimiento(e.fecha)
    if (e.tipo === 'compra') {
      // Con la base de datos, cada compra ya trae los puntos y el nivel con que se guardó.
      const ganados = e.dato.puntos ?? puntosPorCompra(e.dato.total, nivel, reglas)
      puntosPorCompraId[e.dato.id] = { puntos: ganados, nivel: e.dato.nivel ?? reglas.niveles[nivel].nombre }
      puntos += ganados
      acumulado += e.dato.total
      const siguiente = reglas.niveles[nivel + 1]
      if (siguiente && acumulado >= siguiente.desde) nivel += 1
      ultimaCompra = e.fecha
    } else {
      puntos -= e.dato.puntos
    }
  }
  aplicarVencimiento(hoy)

  const ultima = activas.length ? activas[activas.length - 1].fecha : null
  const siguiente = reglas.niveles[nivel + 1]
  return {
    nivel: reglas.niveles[nivel].nombre,
    indiceNivel: nivel,
    acumulado,
    puntos,
    pesosCanje: puntos * reglas.valorPunto,
    puedeCanjear: puntos >= reglas.minimoCanje,
    vigencia: ultima && puntos > 0 ? sumarMeses(ultima, reglas.vigenciaMeses) : null,
    ultimaCompra: ultima,
    siguienteNivel: siguiente?.nombre ?? null,
    faltaParaSiguiente: siguiente ? Math.max(siguiente.desde - acumulado, 0) : null,
    puntosPorCompraId,
  }
}

export function mensajeWhatsApp({ nombre, ganados, puntos, nivel, vigencia, enlace }) {
  const partes = [`Hola ${nombre}, gracias por tu compra en Joyería Torres Torres.`]
  if (ganados != null) partes.push(`Hoy ganaste ${ganados} puntos y ahora tienes ${puntos} disponibles (nivel ${nivel}).`)
  else partes.push(`Tienes ${puntos} puntos disponibles (nivel ${nivel}).`)
  if (vigencia) partes.push(`Tus puntos vencen el ${vigencia.toLocaleDateString('es-MX')}.`)
  partes.push(`Consulta tu tarjeta aquí: ${enlace}`)
  return partes.join(' ')
}

export function enlaceWhatsApp(telefono, texto) {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`
}

export const enlaceTarjeta = (token) => `${window.location.origin}/tarjeta/${token}`
