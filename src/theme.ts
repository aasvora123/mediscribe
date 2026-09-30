// Abridge-inspired Design System
// Derived from: abridge.com

export const COLORS = {
  // Primary palette
  accent:     '#EA2C00', // Abridge red-orange — CTAs, highlights, live indicator
  accentHover:'#C42200',
  black:      '#141312', // Near-black body text
  charcoal:   '#2B2926', // Headlines
  taupe:      '#6D645A', // Secondary / muted text
  warmWhite:  '#F7F2ED', // Warm cream backgrounds (alternating sections)
  lightGray:  '#F6F6F6', // Cool light gray backgrounds
  white:      '#FFFFFF',
  border:     '#DDDDDD', // 1px section dividers
  borderLight:'#EBEBEB',

  // Status
  green:      '#1B7A1B',
  greenBg:    '#EDF7ED',
  amber:      '#8C5A00',
  amberBg:    '#FFF4E0',
};

export const FONT = {
  // Inter — closest open-source match to Abridge's geometric sans-serif
  thin:           'Inter_300Light',
  regular:        'Inter_400Regular',
  medium:         'Inter_500Medium',
  semibold:       'Inter_600SemiBold',
  bold:           'Inter_700Bold',
  extrabold:      'Inter_800ExtraBold',
};

export const RADIUS = {
  none:    0,   // Abridge uses very sharp corners
  sm:      4,
  md:      6,
  lg:      10,
};

export const SHADOW = {
  card: {
    shadowColor: '#141312',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  strong: {
    shadowColor: '#141312',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};
