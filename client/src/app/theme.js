import { theme } from 'antd'

export const appTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#256f61',
    colorSuccess: '#2f7d55',
    colorWarning: '#b7791f',
    colorError: '#bd3f32',
    colorInfo: '#315f9c',
    colorText: '#1f2933',
    colorBgLayout: '#f5f7fa',
    borderRadius: 6,
    fontFamily: "Inter, system-ui, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      siderBg: '#10233f',
    },
    Menu: {
      darkItemBg: '#10233f',
      darkSubMenuItemBg: '#10233f',
      darkItemSelectedBg: '#256f61',
    },
    Card: {
      borderRadiusLG: 8,
    },
  },
}
