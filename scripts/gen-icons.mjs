import sharp from 'sharp'
import { readFileSync } from 'fs'
import { mkdirSync } from 'fs'

mkdirSync('./public', { recursive: true })

const svg = readFileSync('./icon-source.svg')

await sharp(svg).resize(512, 512).png().toFile('./public/icon-512.png')
await sharp(svg).resize(192, 192).png().toFile('./public/icon-192.png')
await sharp(svg).resize(180, 180).png().toFile('./public/apple-touch-icon.png')
await sharp(svg).resize(32,  32 ).png().toFile('./public/favicon-32.png')

console.log('Icons generated.')
