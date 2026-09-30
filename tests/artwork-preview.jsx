import React from 'react'
import { createRoot } from 'react-dom/client'
import ArtworkPreview from '../src/ArtworkPreview.jsx'

createRoot(document.getElementById('root')).render(
  <main style={{ maxWidth: 260, margin: '24px auto', fontFamily: 'sans-serif' }}>
    <h1>Artwork preview</h1>
    <ArtworkPreview src="/logo.jpg" alt="AssetX test image" />
  </main>,
)
