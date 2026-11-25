/** Locale bundles for the workbench panel and its sidebar entry. */

/** Locale keys the workbench surfaces render. */
export type WorkbenchKey =
  | 'nav'
  | 'title'
  | 'intro'
  | 'sectionArticles'
  | 'sectionArticlesHint'
  | 'sectionAssets'
  | 'sectionAssetsHint'
  | 'sectionPublish'
  | 'sectionPublishHint'
  | 'sectionPrompt'
  | 'sectionPromptHint'
  | 'statusPlanned'

/** English copy of the workbench surfaces. */
const en: Record<WorkbenchKey, string> = {
  nav: 'Workbench',
  title: 'Workbench',
  intro: 'Draft the prompt that generates your articles, then keep refining it in conversation.',
  sectionArticles: 'Articles',
  sectionArticlesHint: 'Drafts and published pieces land here.',
  sectionAssets: 'Assets',
  sectionAssetsHint: 'Reference images and source material.',
  sectionPublish: 'Publishing',
  sectionPublishHint: 'Channels and scheduled releases.',
  sectionPrompt: 'Generation prompt',
  sectionPromptHint: 'The prompt the agent refines with you.',
  statusPlanned: 'Not built yet',
}

/** Chinese copy of the workbench surfaces. */
const zh: Record<WorkbenchKey, string> = {
  nav: '工作台',
  title: '工作台',
  intro: '先打磨生成文章用的提示词,再在对话里继续让它变好。',
  sectionArticles: '文章',
  sectionArticlesHint: '草稿与已发布的内容都在这里。',
  sectionAssets: '素材',
  sectionAssetsHint: '参考图与原始资料。',
  sectionPublish: '发布',
  sectionPublishHint: '发布渠道与定时投放。',
  sectionPrompt: '生成提示词',
  sectionPromptHint: '你和 agent 一起打磨的那份提示词。',
  statusPlanned: '尚未实现',
}

/** Japanese copy of the workbench surfaces. */
const ja: Record<WorkbenchKey, string> = {
  nav: 'ワークベンチ',
  title: 'ワークベンチ',
  intro: '記事生成用のプロンプトを書き、会話を通じて磨き込みます。',
  sectionArticles: '記事',
  sectionArticlesHint: '下書きと公開済みの成分がここにあります。',
  sectionAssets: '素材',
  sectionAssetsHint: '参照画像と元資料。',
  sectionPublish: '公開',
  sectionPublishHint: '配信チャンネルと予約投稿。',
  sectionPrompt: '生成プロンプト',
  sectionPromptHint: 'エージェントと一緒に磨き込むプロンプト。',
  statusPlanned: '未実装',
}

/** Spanish copy of the workbench surfaces. */
const es: Record<WorkbenchKey, string> = {
  nav: 'Banco de trabajo',
  title: 'Banco de trabajo',
  intro: 'Redacta el prompt que genera tus artículos y sigue mejorándolo en la conversación.',
  sectionArticles: 'Artículos',
  sectionArticlesHint: 'Borradores y piezas publicadas.',
  sectionAssets: 'Materiales',
  sectionAssetsHint: 'Imágenes de referencia y fuentes.',
  sectionPublish: 'Publicación',
  sectionPublishHint: 'Canales y entregas programadas.',
  sectionPrompt: 'Prompt de generación',
  sectionPromptHint: 'El prompt que el agente refina contigo.',
  statusPlanned: 'Aún no implementado',
}

/** French copy of the workbench surfaces. */
const fr: Record<WorkbenchKey, string> = {
  nav: 'Atelier',
  title: 'Atelier',
  intro: 'Rédigez le prompt qui génère vos articles, puis affinez-le en conversation.',
  sectionArticles: 'Articles',
  sectionArticlesHint: 'Brouillons et articles publiés.',
  sectionAssets: 'Ressources',
  sectionAssetsHint: 'Images de référence et sources.',
  sectionPublish: 'Publication',
  sectionPublishHint: 'Chaînes et publications planifiées.',
  sectionPrompt: 'Prompt de génération',
  sectionPromptHint: 'Le prompt que l’agent affine avec vous.',
  statusPlanned: 'Pas encore implémenté',
}

/** German copy of the workbench surfaces. */
const de: Record<WorkbenchKey, string> = {
  nav: 'Werkbank',
  title: 'Werkbank',
  intro: 'Verfasse den Prompt für deine Artikel und verfeinere ihn im Gespräch.',
  sectionArticles: 'Artikel',
  sectionArticlesHint: 'Entwürfe und veröffentlichte Beiträge.',
  sectionAssets: 'Material',
  sectionAssetsHint: 'Referenzbilder und Quellen.',
  sectionPublish: 'Veröffentlichung',
  sectionPublishHint: 'Kanäle und geplante Veröffentlichungen.',
  sectionPrompt: 'Generierungs-Prompt',
  sectionPromptHint: 'Der Prompt, den der Agent mit dir verfeinert.',
  statusPlanned: 'Noch nicht umgesetzt',
}

/** Russian copy of the workbench surfaces. */
const ru: Record<WorkbenchKey, string> = {
  nav: 'Рабочий стол',
  title: 'Рабочий стол',
  intro: 'Составьте промпт для генерации статей и дорабатывайте его в диалоге.',
  sectionArticles: 'Статьи',
  sectionArticlesHint: 'Черновики и опубликованные материалы.',
  sectionAssets: 'Материалы',
  sectionAssetsHint: 'Референсные изображения и источники.',
  sectionPublish: 'Публикация',
  sectionPublishHint: 'Каналы и запланированные выпуски.',
  sectionPrompt: 'Промпт генерации',
  sectionPromptHint: 'Промпт, который агент дополняет вместе с вами.',
  statusPlanned: 'Ещё не реализовано',
}

/** Portuguese copy of the workbench surfaces. */
const pt: Record<WorkbenchKey, string> = {
  nav: 'Bancada',
  title: 'Bancada',
  intro: 'Escreva o prompt que gera seus artigos e continue refinando-o na conversa.',
  sectionArticles: 'Artigos',
  sectionArticlesHint: 'Rascunhos e peças publicadas.',
  sectionAssets: 'Materiais',
  sectionAssetsHint: 'Imagens de referência e fontes.',
  sectionPublish: 'Publicação',
  sectionPublishHint: 'Canais e publicações agendadas.',
  sectionPrompt: 'Prompt de geração',
  sectionPromptHint: 'O prompt que o agente refina com você.',
  statusPlanned: 'Ainda não implementado',
}

export { de, en, es, fr, ja, pt, ru, zh }
