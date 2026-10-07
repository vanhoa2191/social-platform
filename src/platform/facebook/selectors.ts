export const facebookSelectors = {
  articles: ['[role="article"]', 'article'],
  composer: ['[contenteditable="true"][role="textbox"]', '[contenteditable="true"]'],
  commentControls: ['button', '[role="button"]'],
  profileAnchors: [
    '[role="navigation"] a[aria-label*="profile" i][href]',
    '[role="navigation"] a[aria-label*="trang cá nhân" i][href]',
    'header a[aria-label*="profile" i][href]',
    'header a[aria-label*="trang cá nhân" i][href]',
    '[role="navigation"] a[href*="profile.php?id="]',
  ],
} as const
