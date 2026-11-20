import { pesos, urlPagina } from './formato'

// Reglas del programa de lealtad (documento "Sistema de ventas y lealtad").
// En la versión final estas reglas vendrán de la tabla de configuración;
// aquí son los valores iniciales que maneja el negocio.

export const REGLAS_INICIALES = {
  bloquePesos: 10, // puntos por cada $10
  valorPunto: 0.25, // $ por punto al canjear
  minimoCanje: 1, // puntos mínimos para canjear (1 = canje abierto)
  vigenciaMeses: 6,
  nivelesPorCompra: 1, // cuántos niveles puede subir con una compra (0 = sin límite)
  bajaAlVencer: true, // al vencer los puntos, también baja un nivel
  niveles: [
    // regaloCumple: pesos de regalo para canjear en su mes de cumpleaños (0 = sin regalo).
    { nombre: 'Plata', desde: 0, puntosPorBloque: 1, regaloCumple: 100, beneficio: 'Acceso al programa, acumulación de puntos y regalo de cumpleaños' },
    { nombre: 'Oro', desde: 2000, puntosPorBloque: 2, regaloCumple: 200, beneficio: 'Doble puntos, limpieza gratis, regalo de cumpleaños y promociones especiales' },
    { nombre: 'Diamante', desde: 5000, puntosPorBloque: 2, regaloCumple: 300, beneficio: 'Doble puntos, limpieza gratis, regalo de cumpleaños y beneficios exclusivos' },
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
// - sube como máximo reglas.nivelesPorCompra niveles por compra (0 = sin límite);
// - si pasan N meses sin comprar, los puntos vencen y, si reglas.bajaAlVencer,
//   baja un solo nivel con el acumulado reiniciado en el mínimo de ese nivel.
// Con saldo (clientes importados del Excel) arranca con el nivel y los puntos
// que tenía en la fecha del corte; lo anterior al corte es solo historial.
export function resumenCliente(compras, canjes, reglas = REGLAS_INICIALES, hoy = new Date(), saldo = null) {
  const activas = compras.filter((c) => !c.cancelada).sort((a, b) => a.fecha - b.fecha)
  const corte = saldo && saldo.fecha <= hoy ? saldo.fecha : null
  const eventos = [
    ...activas.map((c) => ({ tipo: 'compra', fecha: c.fecha, dato: c })),
    ...canjes.map((c) => ({ tipo: 'canje', fecha: c.fecha, dato: c })),
  ]
    .filter((e) => !corte || e.fecha > corte)
    .sort((a, b) => a.fecha - b.fecha)

  let nivel = 0
  let acumulado = 0
  let puntos = 0
  let ultimaCompra = null
  const puntosPorCompraId = {}
  if (corte) {
    nivel = Math.max(reglas.niveles.findIndex((n) => n.id === saldo.nivelId), 0)
    acumulado = saldo.acumulado
    puntos = saldo.puntos
    ultimaCompra = saldo.venceDesde
    for (const c of activas) if (c.fecha <= corte) puntosPorCompraId[c.id] = { puntos: c.puntos, nivel: c.nivel }
  }

  const aplicarVencimiento = (hasta) => {
    if (ultimaCompra && sumarMeses(ultimaCompra, reglas.vigenciaMeses) <= hasta && puntos + acumulado > 0) {
      puntos = 0
      if (reglas.bajaAlVencer !== false && nivel > 0) {
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
      const limite = reglas.nivelesPorCompra ?? 1
      let subidos = 0
      while (reglas.niveles[nivel + 1] && acumulado >= reglas.niveles[nivel + 1].desde && (limite === 0 || subidos < limite)) {
        nivel += 1
        subidos += 1
      }
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

// Mensaje desde la ficha de la cliente: no hubo compra, solo comparte el estado de su tarjeta.
export function mensajeEstadoTarjeta({ nombre, puntos, nivel, vigencia, enlace }) {
  const partes = [
    `Hola ${nombre}, te compartimos el estado de tu tarjeta de lealtad de Joyería Torres Torres.`,
    `Tienes ${puntos} puntos disponibles (nivel ${nivel}).`,
  ]
  if (vigencia) partes.push(`Tus puntos vencen el ${vigencia.toLocaleDateString('es-MX')}.`)
  partes.push(`Consulta tu tarjeta aquí: ${enlace}`)
  return partes.join(' ')
}

export function enlaceWhatsApp(telefono, texto) {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`
}

export const enlaceTarjeta = (token) => urlPagina(`tarjeta/${token}`)

// Regalo de cumpleaños: dinero para canjear durante todo su mes de cumpleaños,
// según su nivel, una vez por año. La base de datos revisa lo mismo al guardar.
export function regaloCumple(cliente, resumen, reglas, regalos, hoy = new Date()) {
  const mes = cliente.cumpleanos && cliente.cumpleanos !== '—' ? Number(cliente.cumpleanos.split('/')[1]) : null
  const anio = hoy.getFullYear()
  const usado = regalos.find((g) => g.clienteId === cliente.id && g.fecha.getFullYear() === anio) ?? null
  return {
    enSuMes: mes === hoy.getMonth() + 1,
    monto: reglas.niveles[resumen.indiceNivel]?.regaloCumple ?? 0,
    usado,
  }
}

// Recordatorio unos días antes del cumpleaños, desde Cumpleaños de la semana.
export function mensajeRecordatorioCumple({ nombre, monto, nivel, enlace }) {
  const partes = [`Hola ${nombre}, en Joyería Torres Torres recordamos que ya viene tu cumpleaños.`]
  if (monto > 0) {
    partes.push(`Por tu nivel ${nivel} tienes ${pesos(monto)} de regalo para canjear en cualquiera de nuestras sucursales durante todo tu mes de cumpleaños.`)
  }
  partes.push(`Consulta tu tarjeta aquí: ${enlace}`)
  return partes.join(' ')
}
