import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

const VIOLET = {
  50: '#f6f4ff',
  100: '#f1eefe',
  200: '#e4ddf8',
  300: '#d3c8fc',
  400: '#9276fb',
  500: '#7955fd',
  600: '#6a49d6',
  700: '#5b3ac4',
  800: '#4a2ea3',
  900: '#392480',
  950: '#231551',
};

const NEUTRAL = {
  0: '#ffffff',
  50: '#faf9fe',
  100: '#f8f7fc',
  200: '#ebe8f4',
  300: '#d3c8fc',
  400: '#9a94ad',
  500: '#7d7791',
  600: '#6f6a80',
  700: '#453f57',
  800: '#1c1830',
  900: '#16121f',
  950: '#0f0c18',
};

const FOCUS_RING = '0 0 0 4px rgba(121, 85, 253, 0.15)';

export const DocublockPreset = definePreset(Aura, {
  primitive: {
    borderRadius: {
      none: '0',
      xs: '3px',
      sm: '4px',
      md: '9px',
      lg: '10px',
      xl: '14px',
    },
  },
  semantic: {
    primary: VIOLET,
    transitionDuration: '0.15s',
    focusRing: {
      width: '0',
      style: 'none',
      color: 'transparent',
      offset: '0',
      shadow: FOCUS_RING,
    },
    formField: {
      paddingX: '13px',
      paddingY: '10px',
      borderRadius: '{border.radius.lg}',
      sm: { fontSize: '11.5px', paddingX: '10px', paddingY: '6px' },
      lg: { fontSize: '13.5px', paddingX: '14px', paddingY: '12px' },
      focusRing: {
        width: '0',
        style: 'none',
        color: 'transparent',
        offset: '0',
        shadow: FOCUS_RING,
      },
    },
    list: {
      padding: '6px',
      gap: '1px',
      option: { padding: '8px 11px', borderRadius: '{border.radius.md}' },
      optionGroup: { padding: '8px 11px', fontWeight: '700' },
    },
    navigation: {
      list: { padding: '6px', gap: '1px' },
      item: {
        padding: '8px 11px',
        borderRadius: '{border.radius.md}',
        gap: '11px',
      },
      submenuLabel: { padding: '10px 11px 6px', fontWeight: '700' },
    },
    content: { borderRadius: '{border.radius.xl}' },
    overlay: {
      select: {
        borderRadius: '{border.radius.lg}',
        shadow: '0 5px 14px -7px rgba(52, 36, 112, 0.26)',
      },
      popover: {
        borderRadius: '{border.radius.xl}',
        padding: '12px',
        shadow: '0 5px 14px -7px rgba(52, 36, 112, 0.26)',
      },
      modal: {
        borderRadius: '{border.radius.xl}',
        padding: '20px 22px',
        shadow: '0 5px 14px -7px rgba(52, 36, 112, 0.26)',
      },
      navigation: { shadow: '0 5px 14px -7px rgba(52, 36, 112, 0.26)' },
    },
    colorScheme: {
      light: {
        surface: NEUTRAL,
        primary: {
          color: '#7955fd',
          contrastColor: '#ffffff',
          hoverColor: '#6a49d6',
          activeColor: '#5b3ac4',
        },
        highlight: {
          background: '#f1eefe',
          focusBackground: '#e4ddf8',
          color: '#6a49d6',
          focusColor: '#5b3ac4',
        },
        text: {
          color: '#1c1830',
          hoverColor: '#16121f',
          mutedColor: '#7d7791',
          hoverMutedColor: '#6f6a80',
        },
        content: {
          background: '#ffffff',
          hoverBackground: '#faf9fe',
          borderColor: '#ebe8f4',
          color: '#1c1830',
          hoverColor: '#16121f',
        },
        formField: {
          background: '#ffffff',
          disabledBackground: '#f8f7fc',
          filledBackground: '#ffffff',
          filledHoverBackground: '#ffffff',
          filledFocusBackground: '#ffffff',
          borderColor: '#e6e2f0',
          hoverBorderColor: '#ded4fb',
          focusBorderColor: '#7955fd',
          invalidBorderColor: '#cc3d1c',
          color: '#16121f',
          disabledColor: '#9a94ad',
          placeholderColor: '#9a94ad',
          floatLabelColor: '#7d7791',
          iconColor: '#7d7791',
          shadow: 'none',
        },
        navigation: {
          item: {
            focusBackground: '#f4f2fb',
            activeBackground: '#f1eefe',
            color: '#453f57',
            focusColor: '#16121f',
            activeColor: '#16121f',
            icon: {
              color: '#7d7791',
              focusColor: '#6a49d6',
              activeColor: '#6a49d6',
            },
          },
          submenuLabel: { background: 'transparent', color: '#8a7fb8' },
          submenuIcon: {
            color: '#8a7fb8',
            focusColor: '#6a49d6',
            activeColor: '#6a49d6',
          },
        },
        mask: { background: 'rgba(22, 18, 31, 0.42)', color: '#ffffff' },
      },
    },
  },
  components: {
    card: {
      root: {
        background: '#ffffff',
        borderRadius: '14px',
        color: '#1c1830',
        shadow: '0 2px 8px -4px rgba(52, 36, 112, 0.09)',
      },
      body: { padding: '20px 22px', gap: '14px' },
      title: { fontSize: '13px', fontWeight: '600' },
      subtitle: { color: '#7d7791' },
    },
    button: {
      root: {
        borderRadius: '9px',
        paddingX: '13px',
        paddingY: '7px',
        gap: '8px',
        iconOnlyWidth: '34px',
        label: { fontWeight: '600' },
        sm: { fontSize: '11.5px', paddingX: '10px', paddingY: '5px' },
        lg: { fontSize: '13.5px', paddingX: '16px', paddingY: '9px' },
        focusRing: { width: '0', style: 'none', offset: '0' },
      },
      colorScheme: {
        light: {
          root: {
            primary: { focusRing: { color: 'transparent', shadow: FOCUS_RING } },
            secondary: {
              background: '#f8f7fc',
              hoverBackground: '#f4f2fb',
              activeBackground: '#ebe6f8',
              borderColor: '#ebe8f4',
              hoverBorderColor: '#d3c8fc',
              activeBorderColor: '#d3c8fc',
              color: '#453f57',
              hoverColor: '#16121f',
              activeColor: '#16121f',
              focusRing: { color: 'transparent', shadow: FOCUS_RING },
            },
          },
          text: {
            primary: { color: '#6a49d6', hoverBackground: '#f1eefe', activeBackground: '#e4ddf8' },
            secondary: {
              color: '#6f6a80',
              hoverBackground: '#f4f2fb',
              activeBackground: '#ebe6f8',
            },
          },
        },
      },
    },
    badge: {
      root: {
        borderRadius: '20px',
        padding: '2px 7px',
        fontSize: '10.5px',
        fontWeight: '600',
        minWidth: '21px',
        height: '20px',
      },
      sm: { fontSize: '10px', minWidth: '18px', height: '18px' },
      colorScheme: {
        light: {
          primary: { background: '#f1eefe', color: '#6a49d6' },
          secondary: { background: '#f4f2fb', color: '#6f6a80' },
          danger: { background: '#fdf0ec', color: '#cc3d1c' },
        },
      },
    },
    tag: {
      root: {
        fontSize: '10.5px',
        fontWeight: '600',
        padding: '2px 7px',
        gap: '4px',
        borderRadius: '20px',
      },
      icon: { size: '11px' },
    },
    menu: {
      root: {
        background: '#ffffff',
        borderColor: '#ebe8f4',
        borderRadius: '13px',
        color: '#1c1830',
        shadow: '0 5px 14px -7px rgba(52, 36, 112, 0.26)',
      },
      list: { padding: '6px', gap: '1px' },
      item: { padding: '8px 11px', borderRadius: '9px', gap: '11px' },
      submenuLabel: {
        padding: '10px 11px 6px',
        fontWeight: '700',
        background: 'transparent',
        color: '#8a7fb8',
      },
      separator: { borderColor: '#ebe8f4' },
    },
    panelmenu: {
      root: { gap: '1px' },
      panel: {
        background: 'transparent',
        borderColor: 'transparent',
        borderWidth: '0',
        padding: '0',
        borderRadius: '9px',
      },
      item: { padding: '8px 11px', borderRadius: '9px', gap: '11px' },
    },
    datatable: {
      headerCell: {
        background: 'transparent',
        hoverBackground: 'transparent',
        borderColor: '#ebe8f4',
        color: '#7d7791',
        padding: '8px 0',
      },
      bodyCell: { borderColor: '#f4f2fb', padding: '12px 0' },
      row: { background: 'transparent', hoverBackground: '#faf9fe', color: '#1c1830' },
      footerCell: { background: 'transparent', borderColor: '#ebe8f4' },
    },
    inputtext: {
      root: { borderRadius: '10px', paddingX: '13px', paddingY: '10px' },
    },
    select: {
      root: { borderRadius: '10px', paddingX: '13px', paddingY: '10px' },
      dropdown: { width: '38px', color: '#453f57' },
      option: { padding: '8px 11px' },
      emptyMessage: { padding: '8px 11px' },
    },
    autocomplete: {
      root: { borderRadius: '10px', paddingX: '13px', paddingY: '10px' },
      dropdown: { width: '38px' },
      option: { padding: '8px 11px' },
      emptyMessage: { padding: '8px 11px' },
    },
    datepicker: {
      panel: { borderRadius: '14px', padding: '12px' },
      dropdown: { width: '38px' },
    },
    toast: {
      root: { borderRadius: '14px', borderWidth: '1px' },
      content: { padding: '14px 16px', gap: '12px' },
      text: { gap: '4px' },
      summary: { fontSize: '12.5px', fontWeight: '600' },
      detail: { fontSize: '12px' },
    },
    dialog: {
      root: { borderRadius: '14px', shadow: '0 5px 14px -7px rgba(52, 36, 112, 0.26)' },
      header: { padding: '20px 22px 12px', gap: '8px' },
      title: { fontSize: '16px', fontWeight: '600' },
      content: { padding: '0 22px 12px' },
      footer: { padding: '12px 22px 20px', gap: '8px' },
    },
    divider: {
      root: { borderColor: '#ebe8f4' },
    },
  },
});
