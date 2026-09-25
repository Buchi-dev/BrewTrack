import { theme } from 'antd'
import { BRAND } from '../constants/brand.js'

export const appTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: BRAND.colors.amber,
    colorSuccess: '#3d7b4f',
    colorWarning: BRAND.colors.amberDark,
    colorError: '#bd3f32',
    colorInfo: '#7a542e',
    colorText: '#241f1a',
    colorBgLayout: BRAND.colors.cream,
    borderRadius: 6,
    fontFamily: "Inter, system-ui, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: BRAND.colors.charcoal,
    },
    Menu: {
      darkItemBg: BRAND.colors.charcoal,
      darkSubMenuItemBg: BRAND.colors.charcoal,
      darkItemSelectedBg: BRAND.colors.amber,
      darkItemHoverBg: '#2a241f',
    },
    Card: {
      borderRadiusLG: 8,
    },
  },
}
