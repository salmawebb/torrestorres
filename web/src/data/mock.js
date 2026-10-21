// Datos de ejemplo para la interfaz. Se reemplazarán por Supabase.

export const SUCURSALES = ['Allende', 'Olmos', 'Hidalgo']

export const USUARIOS = [
  { id: 'u1', nombre: 'Rosa Torres', correo: 'admin@torrestorres.mx', rol: 'admin', activa: true },
  { id: 'u2', nombre: 'Lupita Garza', correo: 'lupita@torrestorres.mx', rol: 'empleada', activa: true },
  { id: 'u3', nombre: 'Karla Méndez', correo: 'karla@torrestorres.mx', rol: 'empleada', activa: true },
  { id: 'u4', nombre: 'Daniela Ríos', correo: 'daniela@torrestorres.mx', rol: 'empleada', activa: true },
  { id: 'u5', nombre: 'Mónica Salas', correo: 'monica@torrestorres.mx', rol: 'empleada', activa: false },
]

const NOMBRES = [
  ['María', 'González López'], ['Ana', 'Martínez Ruiz'], ['Laura', 'Hernández Soto'], ['Sofía', 'Ramírez Cantú'],
  ['Patricia', 'Flores Garza'], ['Claudia', 'Treviño Leal'], ['Fernanda', 'Villarreal Peña'], ['Gabriela', 'Rodríguez Elizondo'],
  ['Mariana', 'Cavazos Lozano'], ['Alejandra', 'Salinas Montemayor'], ['Verónica', 'Guerra Saldaña'], ['Diana', 'Chapa Benavides'],
  ['Jorge', 'Torres Medina'], ['Roberto', 'Garza Sepúlveda'], ['Luis', 'Martínez Zambrano'], ['Carlos', 'Leal Cárdenas'],
  ['Andrea', 'Ortiz Quintanilla'], ['Paola', 'Ibarra Tamez'], ['Daniela', 'Sánchez Barrera'], ['Lucía', 'Morales Cortés'],
]

// Generador determinista para que los datos no cambien en cada recarga.
let semilla = 7
const azar = () => {
  semilla = (semilla * 16807) % 2147483647
  return (semilla - 1) / 2147483646
}

const hoy = new Date()
const haceDias = (d, hora = 12) => {
  const f = new Date(hoy)
  f.setDate(f.getDate() - d)
  f.setHours(hora, Math.floor(azar() * 60), 0, 0)
  return f
}

const token = () => Array.from({ length: 4 }, () => Math.floor(azar() * 0xffffffff).toString(16).padStart(8, '0')).join('-')

export function crearDatosIniciales() {
  semilla = 7
  const clientes = NOMBRES.map(([nombre, apellidos], i) => {
    const cumple = new Date(hoy)
    // Algunos cumplen esta semana para que se vea la sección.
    cumple.setDate(cumple.getDate() + (i % 6 === 0 ? i % 5 : 20 + i * 9))
    return {
      id: 1001 + i,
      nombre,
      apellidos,
      telefono: `5281${String(10000000 + Math.floor(azar() * 89999999)).slice(0, 8)}`,
      cumpleanos: `${String(cumple.getDate()).padStart(2, '0')}/${String(cumple.getMonth() + 1).padStart(2, '0')}`,
      registro: haceDias(400 - i * 12),
      registradoPor: USUARIOS[1 + (i % 3)].id,
      notas: i === 2 ? 'Prefiere oro blanco.' : '',
      token: token(),
    }
  })

  const compras = []
  let folio = { Allende: 4210, Olmos: 1830, Hidalgo: 2675 }
  clientes.forEach((c, i) => {
    const n = 1 + Math.floor(azar() * 7)
    // Un par de clientes sin comprar hace más de 6 meses para ver el vencimiento.
    const inicio = i === 7 || i === 15 ? 380 : 300
    for (let k = 0; k < n; k++) {
      const dias = i === 7 || i === 15 ? inicio - k * 25 : Math.floor(azar() * inicio)
      const sucursal = SUCURSALES[Math.floor(azar() * 3)]
      folio[sucursal] += 1
      compras.push({
        id: `v${compras.length + 1}`,
        clienteId: c.id,
        fecha: haceDias(dias, 10 + Math.floor(azar() * 9)),
        sucursal,
        total: Math.round((200 + azar() * 1300) / 10) * 10 + (azar() > 0.6 ? 8 : 0),
        ticket: String(folio[sucursal]),
        empleadaId: USUARIOS[1 + Math.floor(azar() * 3)].id,
        cancelada: false,
      })
    }
  })

  // Ventas de hoy y de esta semana para las páginas iniciales.
  for (let k = 0; k < 9; k++) {
    const sucursal = SUCURSALES[k % 3]
    folio[sucursal] += 1
    compras.push({
      id: `v${compras.length + 1}`,
      clienteId: clientes[(k * 3) % clientes.length].id,
      fecha: haceDias(k < 4 ? 0 : k - 3, 10 + k),
      sucursal,
      total: Math.round((300 + azar() * 1800) / 10) * 10,
      ticket: String(folio[sucursal]),
      empleadaId: USUARIOS[1 + (k % 3)].id,
      cancelada: false,
    })
  }

  // Un ticket duplicado para "Pendientes de revisión".
  const dup = compras[compras.length - 1]
  compras.push({ ...dup, id: `v${compras.length + 1}`, clienteId: clientes[11].id, total: 640, fecha: haceDias(1, 17) })

  const canjes = [
    { id: 'c1', clienteId: clientes[2].id, fecha: haceDias(40), sucursal: 'Olmos', puntos: 200, pesos: 50, empleadaId: 'u2' },
    { id: 'c2', clienteId: clientes[9].id, fecha: haceDias(12), sucursal: 'Allende', puntos: 240, pesos: 60, empleadaId: 'u3' },
  ]

  return { clientes, compras, canjes, usuarios: USUARIOS }
}

export { token as nuevoToken }
