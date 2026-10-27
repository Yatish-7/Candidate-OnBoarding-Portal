// The app's look, in one place. antd reads these "tokens" for every component,
// so changing colorPrimary here re-colors all buttons, links, tags, steps, etc.
// Reference: https://ant.design/docs/react/customize-theme

// Clean, professional palette: a graphite (slate) base for text and structure,
// lifted by a refined blue accent drawn from the company logo. Blue is distinct
// from the danger red (used for declines), so the two never clash.
const BRAND = '#2563eb' // blue-600 (accent)
const BRAND_HOVER = '#1d4ed8' // blue-700
const BRAND_ACTIVE = '#1e40af' // blue-800
const INK = '#0f172a' // slate-900 (headings / graphite base)
const SIDEBAR = '#0f172a' // deep graphite sidebar

const theme = {
  token: {
    colorPrimary: BRAND,
    colorInfo: BRAND,
    colorLink: BRAND,
    colorLinkHover: BRAND_HOVER,
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#e11d48',
    colorBgLayout: '#f5f7fa', // the light page background
    colorBorderSecondary: '#e8edf3', // softer card borders
    colorTextHeading: INK,
    borderRadius: 10,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    boxShadowSecondary: '0 6px 18px rgba(15, 23, 42, 0.08)',
  },
  components: {
    Card: { borderRadiusLG: 14, headerFontSize: 15, paddingLG: 20 },
    Button: { fontWeight: 500, primaryShadow: '0 2px 8px rgba(37, 99, 235, 0.24)' },
    Layout: {
      siderBg: SIDEBAR,
      triggerBg: '#0f172a',
      headerBg: '#ffffff',
      bodyBg: '#f5f7fa',
    },
    // Dark sidebar menu: muted slate links, a lighter hover, and the blue accent
    // for the active link.
    Menu: {
      darkItemBg: SIDEBAR,
      darkItemColor: '#cbd5e1',
      darkItemHoverBg: '#1e293b',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedBg: BRAND,
      darkItemSelectedColor: '#ffffff',
      itemBorderRadius: 8,
      itemMarginInline: 12,
      itemHeight: 44,
      iconSize: 17,
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475569',
      headerSplitColor: 'transparent',
      rowHoverBg: '#eff6ff', // light blue
    },
    Steps: { colorPrimary: BRAND },
  },
}

export default theme
