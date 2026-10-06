import { useEffect, useRef, useState } from 'react'
import { Modal } from './Comunes'
import { useDatos } from '../context/Datos'

// Vista de la cámara para escanear el QR de la tarjeta del cliente.
// La lectura real del código se conectará después; mientras, se puede
// simular eligiendo un cliente de ejemplo.
export default function EscanerQR({ abierto, onCerrar, onEncontrado }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  const { clientes } = useDatos()

  useEffect(() => {
    if (!abierto) return
    let stream
    setError('')
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => setError('No se pudo abrir la cámara. Revisa el permiso del navegador o busca por teléfono.'))
    if (!navigator.mediaDevices) setError('Este navegador no permite usar la cámara aquí. Busca por teléfono.')
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [abierto])

  return (
    <Modal abierto={abierto} titulo="Escanear tarjeta del cliente" onCerrar={onCerrar}>
      <div className="escaner">
        {error ? <p className="escaner-error">{error}</p> : <video ref={video} autoPlay playsInline muted />}
        <div className="escaner-marco" aria-hidden="true" />
      </div>
      <p className="ayuda">Apunta la cámara al código QR de la tarjeta.</p>
      <button className="btn btn-secundario btn-bloque" onClick={() => onEncontrado(clientes[0])}>
        Simular lectura (demo)
      </button>
    </Modal>
  )
}
