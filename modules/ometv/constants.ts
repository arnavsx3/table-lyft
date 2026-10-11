export const WINGMAN_WS_EVENT_NAME = '__WINGMAN_OME_WS_MESSAGE__';

export const OMETV_SELECTORS = {
  // Common buttons across desktop/mobile web OmeTV layouts
  nextButton: [
    '.chat__button_next',
    '.chat__button--next',
    'button.next',
    '[data-action="next"]',
    'button[aria-label*="next" i]',
    'button[aria-label*="skip" i]',
    '.controls__button_next',
    '.controls button:last-child'
  ],
  startButton: [
    '.chat__button_start',
    '.controls__button_start',
    'button[aria-label*="start" i]'
  ],
  stopButton: [
    '.chat__button_stop',
    '.controls__button_stop',
    'button[aria-label*="stop" i]'
  ],
  partnerDetails: [
    '.chat__remote-user',
    '.partner-info',
    '.remote-video-container',
    '.chat-info',
    '.stranger-info'
  ],
  genderIcons: [
    '.icon-male',
    '.icon-female',
    '.icon-boy',
    '.icon-girl',
    '[data-gender]'
  ]
};

export const MALE_IDENTIFIERS = [
  'male',
  'boy',
  'man',
  'm',
  'guy',
  '♂'
];

export const FEMALE_IDENTIFIERS = [
  'female',
  'girl',
  'woman',
  'f',
  'lady',
  '♀'
];
