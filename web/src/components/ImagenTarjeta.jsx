import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

// Botón que arma la imagen de la tarjeta (negro, dorado y beige) con el nombre
// de pila y el QR del cliente, para guardarla en el celular o mandarla por
// WhatsApp. No lleva puntos: esos se consultan al escanear el QR.
export default function BotonImagenTarjeta({ nombre, enlace, className = 'btn btn-secundario', children = 'Descargar imagen de la tarjeta' }) {
  const qr = useRef(null)
  const [ocupado, setOcupado] = useState(false)

  const descargar = async () => {
    setOcupado(true)
    try {
      const archivo = await dibujarTarjeta(nombre.split(' ')[0], qr.current.querySelector('canvas'))
      const datos = { files: [archivo], title: 'Tarjeta Torres Torres' }
      if (navigator.canShare?.(datos)) {
        await navigator.share(datos).catch(() => {})
      } else {
        const url = URL.createObjectURL(archivo)
        const a = document.createElement('a')
        a.href = url
        a.download = archivo.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <div ref={qr} hidden>
        <QRCodeCanvas value={enlace} size={600} marginSize={0} fgColor="#111111" />
      </div>
      <button type="button" className={className} onClick={descargar} disabled={ocupado}>{children}</button>
    </>
  )
}

const ANCHO = 1080
const ALTO = 1920
const NEGRO = '#111111'
const DORADO = '#d6b06a'
const BEIGE = '#efe4d0'

async function dibujarTarjeta(nombre, qr) {
  const estilo = getComputedStyle(document.documentElement)
  const serif = estilo.getPropertyValue('--serif').trim() || 'Georgia, serif'
  const sans = estilo.getPropertyValue('--sans').trim() || 'system-ui, sans-serif'
  await Promise.all([document.fonts.load(`700 96px ${serif}`), document.fonts.load(`400 40px ${sans}`)])

  const lienzo = document.createElement('canvas')
  lienzo.width = ANCHO
  lienzo.height = ALTO
  const c = lienzo.getContext('2d')
  const centro = ANCHO / 2
  c.fillStyle = NEGRO
  c.fillRect(0, 0, ANCHO, ALTO)
  c.strokeStyle = 'rgb(214 176 106 / 45%)'
  c.lineWidth = 3
  c.strokeRect(48, 48, ANCHO - 96, ALTO - 96)

  diamante(c, centro, 250, 150)

  c.textAlign = 'center'
  texto(c, 'Torres Torres', centro, 520, `700 104px ${serif}`, '#ffffff')
  texto(c, 'J O Y E R Í A', centro, 600, `500 34px ${sans}`, DORADO)
  c.fillStyle = DORADO
  c.fillRect(centro - 80, 680, 160, 3)
  texto(c, `Hola, ${nombre}`, centro, 820, `700 88px ${serif}`, '#ffffff')
  texto(c, 'Esta es tu tarjeta de lealtad', centro, 900, `400 44px ${sans}`, BEIGE)

  const lado = 540
  const marco = 40
  const y = 960
  c.fillStyle = '#ffffff'
  redondeado(c, centro - lado / 2 - marco, y, lado + marco * 2, lado + marco * 2, 40)
  c.imageSmoothingEnabled = false
  c.drawImage(qr, centro - lado / 2, y + marco, lado, lado)

  texto(c, 'Escanéala con tu cámara para ver tus puntos.', centro, 1680, `400 40px ${sans}`, BEIGE)
  texto(c, 'Muéstrala en tienda en cada compra.', centro, 1736, `400 40px ${sans}`, BEIGE)
  texto(c, 'Allende · Olmos · Hidalgo', centro, 1820, `500 32px ${sans}`, DORADO)

  const blob = await new Promise((listo) => lienzo.toBlob(listo, 'image/png'))
  return new File([blob], `tarjeta-torres-torres-${nombre.toLowerCase()}.png`, { type: 'image/png' })
}

function texto(c, t, x, y, fuente, color) {
  c.font = fuente
  c.fillStyle = color
  c.fillText(t, x, y)
}

function redondeado(c, x, y, w, h, r) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fill()
}

// El mismo diamante de la marca, escalado desde su caja de 32 × 32.
function diamante(c, cx, cy, tam) {
  const e = tam / 32
  c.save()
  c.translate(cx - 16 * e, cy - 16 * e)
  c.scale(e, e)
  c.strokeStyle = DORADO
  c.lineJoin = 'round'
  c.lineWidth = 1.6
  c.stroke(new Path2D('M16 5l8 8-8 14-8-14z'))
  c.lineWidth = 1.1
  c.stroke(new Path2D('M8 13h16M12.5 13L16 27l3.5-14M12 5.5L12.5 13M20 5.5l-.5 7.5'))
  c.restore()
}
