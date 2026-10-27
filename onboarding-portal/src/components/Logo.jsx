// The Intellectt company logo, rendered as an image so the real brand mark is used
// everywhere (sidebar, login, landing). `size` (sm/md/lg) sets the height; the width
// scales to keep the aspect ratio. Pass `height`, `className` or `style` to tweak it.

const SIZES = { sm: 26, md: 40, lg: 76 }

export default function Logo({ size = 'md', height, className, style }) {
  const h = height ?? SIZES[size] ?? SIZES.md
  return (
    <img
      src="/intellectt-logo.png"
      alt="Intellectt"
      className={className}
      style={{ height: h, width: 'auto', maxWidth: '100%', display: 'block', ...style }}
    />
  )
}
