/** Locale bundles for the workbench panel and its sidebar entry. */

/** Locale keys the workbench surfaces render. */
export type WorkbenchKey =
  | 'nav'
  | 'tabTitle'
  | 'tabGuide'
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
  | 'draftNone'
  | 'draftNoneHint'
  | 'draftRevision'
  | 'draftUpdated'
  | 'draftVersions'
  | 'continueInChat'
  | 'articlesEmpty'
  | 'articlesEmptyHint'
  | 'articleStatusDraft'
  | 'articleStatusReady'
  | 'articleStatusPublished'
  | 'loading'
  | 'loadError'

/** English copy of the workbench surfaces. */
const en: Record<WorkbenchKey, string> = {
  tabTitle: 'Workbench',
  tabGuide: 'The prompt you and the agent refine together, plus your articles.',
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
  draftNone: 'No prompt draft yet',
  draftNoneHint: 'Chat with the agent to shape one together.',
  draftRevision: 'Revision',
  draftUpdated: 'Updated',
  draftVersions: 'revisions',
  continueInChat: 'Continue in chat',
  articlesEmpty: 'No articles yet',
  articlesEmptyHint: 'Ask the agent to write one and it will appear here.',
  articleStatusDraft: 'draft',
  articleStatusReady: 'ready',
  articleStatusPublished: 'published',
  loading: 'Loading…',
  loadError: 'Could not load',
}

/** Chinese copy of the workbench surfaces. */
const zh: Record<WorkbenchKey, string> = {
  tabTitle: '工作台',
  tabGuide: '你和 agent 一起打磨的提示词,以及你的文章。',
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
  draftNone: '还没有提示词草稿',
  draftNoneHint: '去对话里和 agent 一起打磨一份吧。',
  draftRevision: '修订',
  draftUpdated: '更新于',
  draftVersions: '个历史版本',
  continueInChat: '继续在对话里打磨',
  articlesEmpty: '还没有文章',
  articlesEmptyHint: '让 agent 写一篇，成稿会出现在这里。',
  articleStatusDraft: '草稿',
  articleStatusReady: '待发布',
  articleStatusPublished: '已发布',
  loading: '加载中…',
  loadError: '加载失败',
}

/** Japanese copy of the workbench surfaces. */
const ja: Record<WorkbenchKey, string> = {
  tabTitle: 'ワークベンチ',
  tabGuide: 'エージェントと一緒に打磨したプロンプトと記事。',
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
  draftNone: 'プロンプト草稿はまだありません',
  draftNoneHint: 'エージェントと一緒に作成しましょう。',
  draftRevision: 'リビジョン',
  draftUpdated: '更新',
  draftVersions: '件の履歴',
  continueInChat: '会話で続けて磨く',
  articlesEmpty: '記事はまだありません',
  articlesEmptyHint: 'エージェントに書かせるとここに表示されます。',
  articleStatusDraft: '下書き',
  articleStatusReady: '公開待ち',
  articleStatusPublished: '公開済み',
  loading: '読み込み中…',
  loadError: '読み込み失敗',
}

/** Spanish copy of the workbench surfaces. */
const es: Record<WorkbenchKey, string> = {
  tabTitle: 'Banco de trabajo',
  tabGuide: 'El prompt que refinas con el agente y tus artículos.',
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
  draftNone: 'Aún no hay borrador',
  draftNoneHint: 'Chatea con el agente para crear uno.',
  draftRevision: 'Revisión',
  draftUpdated: 'Actualizado',
  draftVersions: 'revisiones',
  continueInChat: 'Continuar en el chat',
  articlesEmpty: 'Aún no hay artículos',
  articlesEmptyHint: 'Pide al agente que escriba uno y aparecerá aquí.',
  articleStatusDraft: 'borrador',
  articleStatusReady: 'listo',
  articleStatusPublished: 'publicado',
  loading: 'Cargando…',
  loadError: 'No se pudo cargar',
}

/** French copy of the workbench surfaces. */
const fr: Record<WorkbenchKey, string> = {
  tabTitle: 'Atelier',
  tabGuide: 'Le prompt que vous affinez avec l’agent et vos articles.',
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
  draftNone: 'Aucun brouillon pour l’instant',
  draftNoneHint: 'Discutez avec l’agent pour en créer un.',
  draftRevision: 'Révision',
  draftUpdated: 'Mis à jour',
  draftVersions: 'révisions',
  continueInChat: 'Continuer dans le chat',
  articlesEmpty: 'Aucun article',
  articlesEmptyHint: 'Demandez à l’agent d’en écrire un ; il apparaîtra ici.',
  articleStatusDraft: 'brouillon',
  articleStatusReady: 'prêt',
  articleStatusPublished: 'publié',
  loading: 'Chargement…',
  loadError: 'Chargement impossible',
}

/** German copy of the workbench surfaces. */
const de: Record<WorkbenchKey, string> = {
  tabTitle: 'Werkbank',
  tabGuide: 'Der Prompt, den du mit dem Agenten verfeinerst, und deine Artikel.',
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
  draftNone: 'Noch kein Prompt-Entwurf',
  draftNoneHint: 'Sprich mit dem Agenten, um einen zu erstellen.',
  draftRevision: 'Revision',
  draftUpdated: 'Aktualisiert',
  draftVersions: 'Revisionen',
  continueInChat: 'Im Chat weiterarbeiten',
  articlesEmpty: 'Noch keine Artikel',
  articlesEmptyHint: 'Lass den Agenten einen schreiben — er erscheint hier.',
  articleStatusDraft: 'Entwurf',
  articleStatusReady: 'bereit',
  articleStatusPublished: 'veröffentlicht',
  loading: 'Lädt…',
  loadError: 'Laden fehlgeschlagen',
}

/** Russian copy of the workbench surfaces. */
const ru: Record<WorkbenchKey, string> = {
  tabTitle: 'Рабочий стол',
  tabGuide: 'Промпт, который вы дорабатываете вместе с агентом, и ваши статьи.',
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
  draftNone: 'Черновика пока нет',
  draftNoneHint: 'Обсудите с агентом, чтобы создать его.',
  draftRevision: 'Ревизия',
  draftUpdated: 'Обновлено',
  draftVersions: 'версий',
  continueInChat: 'Продолжить в чате',
  articlesEmpty: 'Статей пока нет',
  articlesEmptyHint: 'Попросите агента написать — статья появится здесь.',
  articleStatusDraft: 'черновик',
  articleStatusReady: 'готово',
  articleStatusPublished: 'опубликовано',
  loading: 'Загрузка…',
  loadError: 'Не удалось загрузить',
}

/** Portuguese copy of the workbench surfaces. */
const pt: Record<WorkbenchKey, string> = {
  tabTitle: 'Bancada',
  tabGuide: 'O prompt que você refina com o agente e seus artigos.',
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
  draftNone: 'Ainda não há rascunho',
  draftNoneHint: 'Converse com o agente para criar um.',
  draftRevision: 'Revisão',
  draftUpdated: 'Atualizado',
  draftVersions: 'revisões',
  continueInChat: 'Continuar no chat',
  articlesEmpty: 'Ainda não há artigos',
  articlesEmptyHint: 'Peça ao agente para escrever um e ele aparecerá aqui.',
  articleStatusDraft: 'rascunho',
  articleStatusReady: 'pronto',
  articleStatusPublished: 'publicado',
  loading: 'Carregando…',
  loadError: 'Falha ao carregar',
}

export { de, en, es, fr, ja, pt, ru, zh }
