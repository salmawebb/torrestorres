import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { Modal } from './Comunes'
import { useDatos } from '../context/Datos'
import { modoDemo } from '../lib/supabase'
import { tokenDeQR } from '../lib/formato'

// Cámara para escanear el QR de la tarjeta del cliente. Lee cuadro por cuadro
// con BarcodeDetector cuando el navegador lo tiene (Chrome en Android) y con
// jsQR en los demás (Safari en iPhone y iPad, computadoras).
export default function EscanerQR({ abierto, onCerrar, onEncontrado }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const { clientes } = useDatos()
  const buscar = useRef(null)
  const alEncontrar = useRef(onEncontrado)
  useEffect(() => {
    buscar.current = (texto) => clientes.find((c) => c.token && c.token === tokenDeQR(texto))
    alEncontrar.current = onEncontrado
  })

  useEffect(() => {
    if (!abierto) return
    let stream
    let cuadro
    let activo = true
    let ultimoDesconocido = ''
    const lienzo = document.createElement('canvas')
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })
    const detector =
      'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null

    const leer = async () => {
      const v = video.current
      if (v && v.readyState >= 2 && v.videoWidth) {
        let texto = null
        try {
          if (detector) {
            const [c] = await detector.detect(v)
            texto = c?.rawValue ?? null
          } else {
            // Se reduce el cuadro para que la lectura sea rápida en celulares.
            const escala = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight))
            lienzo.width = Math.round(v.videoWidth * escala)
            lienzo.height = Math.round(v.videoHeight * escala)
            ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height)
            const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height)
            texto = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null
          }
        } catch {
          texto = null
        }
        if (!activo) return
        if (texto) {
          const cliente = buscar.current(texto)
          if (cliente) {
            activo = false
            navigator.vibrate?.(80)
            alEncontrar.current(cliente)
            return
          }
          if (texto !== ultimoDesconocido) {
            ultimoDesconocido = texto
            setAviso('Ese QR no es de una tarjeta vigente. Si el cliente pidió un QR nuevo, usa el más reciente o busca por teléfono.')
          }
        }
      }
      if (activo) cuadro = setTimeout(leer, 150)
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Este navegador no permite usar la cámara aquí. Busca por teléfono.')
    } else {
      setError('')
      setAviso('')
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then((s) => {
          if (!activo) return s.getTracks().forEach((t) => t.stop())
          stream = s
          if (video.current) video.current.srcObject = s
          leer()
        })
        .catch(() => setError('No se pudo abrir la cámara. Revisa el permiso del navegador o busca por teléfono.'))
    }
    return () => {
      activo = false
      clearTimeout(cuadro)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [abierto])

  return (
    <Modal abierto={abierto} titulo="Escanear tarjeta del cliente" onCerrar={onCerrar}>
      <div className="escaner">
        {error ? <p className="escaner-error">{error}</p> : <video ref={video} autoPlay playsInline muted />}
        <div className="escaner-marco" aria-hidden="true" />
      </div>
      <p className="ayuda" role="status">{aviso || 'Apunta la cámara al código QR de la tarjeta.'}</p>
      {modoDemo && (
        <button className="btn btn-secundario btn-bloque" onClick={() => onEncontrado(clientes[0])}>
          Simular lectura (demo)
        </button>
      )}
    </Modal>
  )
}
