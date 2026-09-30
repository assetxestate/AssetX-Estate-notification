import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './ArtworkPreview.css'

export default function ArtworkPreview({ src, alt = 'ภาพโพสต์', className = '', style }) {
  const dialog = useRef(null)
  const [zoomed, setZoomed] = useState(false)
  const [failed, setFailed] = useState(false)
  function open(event) {
    event.stopPropagation()
    setZoomed(false)
    setFailed(false)
    dialog.current.showModal()
  }
  const extension = src?.startsWith('data:image/png') ? 'png' : src?.startsWith('data:image/webp') ? 'webp' : 'jpg'
  return <>
    <button type="button" className={`ax-image-trigger ${className}`} style={style}
      aria-label={`ดูภาพขนาดใหญ่: ${alt}`} title="ดูภาพขนาดใหญ่" onClick={open}>
      <img src={src} alt={alt} />
    </button>
    {createPortal(<dialog ref={dialog} className="ax-image-dialog" aria-label={`ภาพขนาดใหญ่: ${alt}`}
      onClick={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current.close()
        }
      }}>
      <header className="ax-image-toolbar">
        <strong>{alt}</strong>
        <button type="button" aria-pressed={zoomed} onClick={() => setZoomed(!zoomed)}>{zoomed ? 'พอดีหน้าจอ' : 'ขนาดจริง'}</button>
        <a href={src} download={`assetx-artwork.${extension}`}>ดาวน์โหลด</a>
        <button type="button" onClick={() => dialog.current.close()} autoFocus>ปิด</button>
      </header>
      <div className={`ax-image-stage ${zoomed ? 'is-zoomed' : ''}`}>
        {failed ? <p role="alert">ไม่สามารถแสดงภาพได้ กรุณาปิดแล้วลองเปิดอีกครั้ง</p>
          : <img src={src} alt={alt} onError={() => setFailed(true)} />}
      </div>
    </dialog>, document.body)}
  </>
}
