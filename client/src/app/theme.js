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
      siderBg: BRAND.colors.espresso,
    },
    Menu: {
      darkItemBg: BRAND.colors.espresso,
      darkSubMenuItemBg: BRAND.colors.espresso,
      darkItemSelectedBg: BRAND.colors.amber,
      darkItemHoverBg: '#3a2418',
    },
    Card: {
      borderRadiusLG: 8,
    },
  },
}
