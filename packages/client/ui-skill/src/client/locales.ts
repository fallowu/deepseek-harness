/** `skill` namespace dictionaries for the dedicated tool row. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'skill'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'row.running': '正在加载 skill',
  'row.failed': 'skill 加载失败',
  'row.stopped': 'skill 加载已中止',
  'row.instructions': '说明',
  'menu.userOnly': '仅用户',
  'settings.nav': '技能',
  'settings.title': '技能目录',
  'settings.intro': '当前项目可用的技能目录。输入 / 加技能名即可调用;目录按项目解析,随当前会话的工作目录变化。',
  'settings.refresh': '刷新',
  'settings.refreshing': '刷新中…',
  'settings.noSession': '尚无会话。创建或选择一个会话后,这里显示该项目的技能目录。',
  'settings.empty': '当前项目没有可用技能。',
  'settings.userOnly': '仅用户调用',
} satisfies Record<string, string>

/** The skill namespace key union. */
export type SkillKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'row.running': 'Loading skill',
  'row.failed': 'Skill load failed',
  'row.stopped': 'Skill load stopped',
  'row.instructions': 'Instructions',
  'menu.userOnly': 'user-only',
  'settings.nav': 'Skills',
  'settings.title': 'Skill catalog',
  'settings.intro': 'The skills available in the current project. Type / plus a skill name to invoke one; the catalog resolves per project from the current session working directory.',
  'settings.refresh': 'Refresh',
  'settings.refreshing': 'Refreshing…',
  'settings.noSession': 'No session yet. Create or select a session to see its project skill catalog here.',
  'settings.empty': 'No skills available in the current project.',
  'settings.userOnly': 'user-only',
} satisfies Record<SkillKey, string>
