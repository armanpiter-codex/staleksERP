import type { Metadata } from "next";
import { GuideScreenshot } from "./GuideScreenshot";

export const metadata: Metadata = {
  title: "Руководство Технолога — Staleks ERP",
  description: "Пошаговое руководство по работе в Staleks ERP для роли Технолог",
};

const sections = [
  { id: "login", title: "1. Вход в систему" },
  { id: "door-types", title: "2. Типы дверей" },
  { id: "models", title: "3. Модели" },
  { id: "sections", title: "4. Секции" },
  { id: "fields", title: "5. Поля" },
  { id: "visibility", title: "6. Правила видимости" },
  { id: "preview", title: "7. Превью" },
  { id: "services", title: "8. Услуги и финансы" },
];

// Screenshot is a client component (GuideScreenshot.tsx) for graceful error handling
const Screenshot = GuideScreenshot;

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 mb-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-staleks-lime text-staleks-sidebar text-sm font-bold flex items-center justify-center mt-0.5">
        {number}
      </span>
      <div className="text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg text-sm text-blue-800 leading-relaxed">
      <span className="font-semibold">💡 Важно: </span>
      {children}
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 bg-staleks-lime/10 border-l-4 border-staleks-lime rounded-r-lg text-sm text-gray-700 leading-relaxed">
      <span className="font-semibold text-staleks-sidebar">✓ Совет: </span>
      {children}
    </div>
  );
}

function FieldBadge({ type }: { type: "select" | "number" | "text" }) {
  const config = {
    select: { label: "Список", color: "bg-purple-100 text-purple-700" },
    number: { label: "Число", color: "bg-orange-100 text-orange-700" },
    text: { label: "Текст", color: "bg-green-100 text-green-700" },
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${config[type].color}`}
    >
      {config[type].label}
    </span>
  );
}

export default function TechGuide() {
  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar nav ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-0 h-screen overflow-y-auto bg-staleks-sidebar text-white">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-staleks-lime flex items-center justify-center font-bold text-staleks-sidebar text-sm">
              S
            </div>
            <span className="font-bold text-white">Staleks ERP</span>
          </div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-4 font-semibold">
            Руководство Технолога
          </p>
          <nav className="space-y-1">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
          <div className="mt-8 pt-6 border-t border-white/10">
            <a
              href="/"
              className="block text-xs text-gray-400 hover:text-staleks-lime transition-colors"
            >
              ← Перейти в систему
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl mx-auto px-6 py-10">
        {/* Header */}
        <header className="mb-12">
          <div className="inline-block px-3 py-1 bg-staleks-lime/20 text-staleks-sidebar text-xs font-semibold rounded-full mb-3">
            РОЛЬ: ТЕХНОЛОГ
          </div>
          <h1 className="text-3xl font-bold text-staleks-sidebar mb-3">
            Руководство по работе в Staleks ERP
          </h1>
          <p className="text-staleks-muted text-lg">
            Пошаговое объяснение: как настроить конфигуратор дверей, управлять
            полями, правилами видимости и услугами.
          </p>
          <div className="mt-4 p-4 bg-staleks-sidebar/5 rounded-xl text-sm text-gray-600">
            <span className="font-semibold">Логин для доступа:</span>{" "}
            <code className="bg-gray-100 px-2 py-0.5 rounded">technologist</code>
            {" / "}
            <code className="bg-gray-100 px-2 py-0.5 rounded">ChangeMe123!</code>
          </div>
        </header>

        {/* ── Section 1: Вход ─────────────────────────────────────────── */}
        <section id="login" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            1. Вход в систему
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Как войти и что увидишь после логина
          </p>

          <Step number={1}>
            Открой браузер и перейди по адресу{" "}
            <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">
              erp.staleks.kz
            </code>{" "}
            (или{" "}
            <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">
              http://89.167.73.83
            </code>
            ).
          </Step>
          <Step number={2}>
            На странице входа введи:
            <div className="mt-2 flex gap-6">
              <div>
                <div className="text-xs text-staleks-muted mb-1">
                  Имя пользователя
                </div>
                <code className="bg-gray-100 px-3 py-1.5 rounded font-mono text-staleks-sidebar">
                  technologist
                </code>
              </div>
              <div>
                <div className="text-xs text-staleks-muted mb-1">Пароль</div>
                <code className="bg-gray-100 px-3 py-1.5 rounded font-mono text-staleks-sidebar">
                  ChangeMe123!
                </code>
              </div>
            </div>
          </Step>
          <Step number={3}>
            Нажми кнопку <strong>«Войти»</strong>. Откроется главный экран
            (Дашборд).
          </Step>
          <Step number={4}>
            В левом сайдбаре (тёмная панель слева) нажми{" "}
            <strong>«Конфигуратор»</strong> — это твой основной рабочий раздел.
          </Step>

          <Screenshot
            src="/guide/01-login.png"
            alt="Страница входа Staleks ERP"
            caption="Страница входа — введи имя пользователя и пароль"
          />

          <Note>
            Роль Технолог даёт доступ только к Конфигуратору. Заказы и
            производство видны только менеджерам и другим ролям.
          </Note>
        </section>

        {/* ── Section 2: Типы дверей ───────────────────────────────────── */}
        <section id="door-types" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            2. Типы дверей
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Первая вкладка Конфигуратора — основа всего
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed">
            Конфигуратор открывается на вкладке{" "}
            <strong>«Типы дверей»</strong>. Здесь ты видишь три карточки — это
            глобальные категории продукции Staleks:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                name: "Техническая",
                desc: "Технические и противопожарные двери (Ei-30, Ei-60, Ei-90, Премиум). Для объектов, складов, производств.",
                fields: 30,
                active: true,
              },
              {
                name: "С Отделкой",
                desc: "Двери с декоративной отделкой (Галант, Модена, Элит, Венеция, Палермо, Винорит). Для квартир и офисов.",
                fields: 48,
                active: true,
              },
              {
                name: "Сложная",
                desc: "Сложные конструкции. В разработке.",
                fields: 0,
                active: false,
              },
            ].map((t) => (
              <div
                key={t.name}
                className={`p-4 rounded-xl border-2 ${
                  t.active
                    ? "border-staleks-lime bg-white"
                    : "border-gray-200 bg-gray-50 opacity-60"
                }`}
              >
                <div className="font-bold text-staleks-sidebar mb-1">
                  {t.name}
                </div>
                <div className="text-xs text-staleks-muted mb-3">{t.desc}</div>
                {t.active ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-bold text-staleks-sidebar">
                      {t.fields}
                    </span>
                    <span className="text-xs text-staleks-muted">
                      активных полей
                    </span>
                    <span className="px-2 py-0.5 bg-staleks-lime/20 text-staleks-sidebar text-xs rounded-full font-medium">
                      Активен
                    </span>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-500 text-xs rounded-full">
                    В разработке
                  </span>
                )}
              </div>
            ))}
          </div>

          <Screenshot
            src="/guide/02-door-types.png"
            alt="Вкладка Типы дверей"
            caption="Типы дверей: Техническая (30 полей) и С Отделкой (48 полей)"
          />

          <Note>
            Типы дверей — это системные категории, изменить их может только
            разработчик. Твоя задача — настраивать модели, поля и правила{" "}
            <em>внутри</em> каждого типа.
          </Note>
        </section>

        {/* ── Section 3: Модели ────────────────────────────────────────── */}
        <section id="models" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            3. Модели
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Конкретные серии дверей в каждом типе
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed">
            Нажми вкладку <strong>«Модели»</strong>. Здесь перечислены все
            серии дверей. Менеджер выбирает модель при создании заказа — это
            влияет на то, какие поля и секции будут показаны при конфигурации
            двери.
          </p>

          <div className="mb-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-staleks-sidebar text-white">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Модель</th>
                  <th className="px-4 py-3 text-left font-semibold">Тип</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Описание
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  {
                    name: "Техническая Стандарт",
                    type: "Техническая",
                    desc: "Базовая техническая дверь",
                  },
                  {
                    name: "Ei-30 / Ei-60 / Ei-90",
                    type: "Техническая",
                    desc: "Противопожарные классы",
                  },
                  {
                    name: "Премиум Тех.",
                    type: "Техническая",
                    desc: "Усиленная конструкция",
                  },
                  {
                    name: "Галант",
                    type: "С Отделкой",
                    desc: "Классический дизайн",
                  },
                  {
                    name: "Модена",
                    type: "С Отделкой",
                    desc: "Современный стиль",
                  },
                  {
                    name: "Элит",
                    type: "С Отделкой",
                    desc: "Премиум отделка",
                  },
                  {
                    name: "Венеция",
                    type: "С Отделкой",
                    desc: "Итальянский стиль",
                  },
                  {
                    name: "Палермо",
                    type: "С Отделкой",
                    desc: "Ламинат/шпон",
                  },
                  {
                    name: "Винорит",
                    type: "С Отделкой",
                    desc: "Покрытие Винорит",
                  },
                ].map((m) => (
                  <tr key={m.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-staleks-sidebar">
                      {m.name}
                    </td>
                    <td className="px-4 py-2.5 text-staleks-muted">{m.type}</td>
                    <td className="px-4 py-2.5 text-gray-600">{m.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Screenshot
            src="/guide/03-models.png"
            alt="Вкладка Модели"
            caption="Модели дверей — серии для каждого типа"
          />

          <Tip>
            На вкладке Модели ты видишь модели в режиме просмотра. Изменение
            моделей (добавление новых серий) выполняется с правами
            администратора.
          </Tip>
        </section>

        {/* ── Section 4: Секции ────────────────────────────────────────── */}
        <section id="sections" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            4. Секции
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Группы полей — как разделы в анкете
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed">
            Нажми вкладку <strong>«Секции (13)»</strong>. Секция — это
            группа связанных полей, которая отображается как раскрывающийся
            блок при конфигурации двери. Например, секция{" "}
            <em>«Замочная группа»</em> содержит все поля, связанные с замками.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {[
              { code: "general", name: "Общие параметры", count: "4–5 полей" },
              { code: "frame", name: "Металл", count: "2–5 полей" },
              { code: "leaf", name: "Полотно", count: "2–4 поля" },
              {
                code: "insulation",
                name: "Огнезащита",
                count: "1–2 поля",
              },
              { code: "lock", name: "Замочная группа", count: "3 поля" },
              { code: "handle", name: "Фурнитура", count: "2–3 поля" },
              {
                code: "finish_ext",
                name: "Наружная отделка",
                count: "1–12 полей",
              },
              {
                code: "finish_int",
                name: "Внутренняя отделка",
                count: "5 полей",
              },
              {
                code: "glass",
                name: "Остекление / Фрамуга",
                count: "4 поля",
              },
              { code: "threshold", name: "Порог", count: "1 поле" },
              { code: "production", name: "Производство", count: "3 поля" },
            ].map((s) => (
              <div
                key={s.code}
                className="p-3 bg-white rounded-lg border border-gray-200 text-sm"
              >
                <div className="font-semibold text-staleks-sidebar">
                  {s.name}
                </div>
                <div className="text-staleks-muted text-xs mt-0.5">
                  {s.count}
                </div>
              </div>
            ))}
          </div>

          <Screenshot
            src="/guide/04-sections.png"
            alt="Вкладка Секции"
            caption="13 секций — группы полей в конфигураторе"
          />

          <Note>
            Количество полей в секции зависит от выбранного типа двери и
            активных правил видимости. Например, секция «Наружная отделка»
            для Технической содержит только 1 поле (цвет металла), а для «С
            Отделкой» — 12 полей.
          </Note>
        </section>

        {/* ── Section 5: Поля ──────────────────────────────────────────── */}
        <section id="fields" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            5. Поля (54 поля)
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Параметры двери — основной объект настройки
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed">
            Нажми вкладку <strong>«Поля (54)»</strong>. Каждое поле — это один
            параметр двери, который заполняет менеджер при создании заказа.
            Здесь ты видишь все 54 активных поля конфигуратора.
          </p>

          <h3 className="text-lg font-semibold text-staleks-sidebar mb-3">
            Типы полей
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                type: "select" as const,
                name: "Выпадающий список",
                desc: 'Менеджер выбирает из готовых вариантов. Пример: "Открывание" = Правое / Левое / Другое.',
                example: 'lock: "Kale 152", "Kale 252+257", "Другое"',
              },
              {
                type: "number" as const,
                name: "Число",
                desc: 'Менеджер вводит числовое значение. Пример: "Высота блока" = 2050 мм.',
                example: "height: 2050, width: 860",
              },
              {
                type: "text" as const,
                name: "Текст",
                desc: 'Менеджер вводит произвольный текст. Пример: "Рисунок (нар.)" = "Венге", "Цвет" = "RAL 7024".',
                example: 'color: "RAL 7024", pattern: "Венге"',
              },
            ].map((ft) => (
              <div key={ft.type} className="p-4 bg-white rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <FieldBadge type={ft.type} />
                  <span className="font-semibold text-staleks-sidebar text-sm">
                    {ft.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{ft.desc}</p>
                <code className="text-xs text-staleks-muted">{ft.example}</code>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-staleks-sidebar mb-3">
            Ключевые поля Технической двери
          </h3>
          <div className="mb-6 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-staleks-sidebar">
                    Поле
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-staleks-sidebar">
                    Тип
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-staleks-sidebar">
                    Значения / Пример
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  {
                    name: "Высота блока",
                    type: "number" as const,
                    val: "2050 мм",
                  },
                  {
                    name: "Ширина блока",
                    type: "number" as const,
                    val: "860 мм",
                  },
                  {
                    name: "Кол-во створок",
                    type: "select" as const,
                    val: "1 створка / 2 створки",
                  },
                  {
                    name: "Открывание",
                    type: "select" as const,
                    val: "Правое / Левое / Другое",
                  },
                  {
                    name: "Противопожарность",
                    type: "select" as const,
                    val: "Нет / EI-30 / EI-60 / EI-90",
                  },
                  {
                    name: "Замок (тех.)",
                    type: "select" as const,
                    val: "Kale 152, Без замка...",
                  },
                  {
                    name: "Цвет металла",
                    type: "text" as const,
                    val: "RAL 7024, RAL 9005...",
                  },
                  {
                    name: "Порог",
                    type: "select" as const,
                    val: "Стандарт 55мм / Низкий 30мм...",
                  },
                ].map((f) => (
                  <tr key={f.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-staleks-sidebar">
                      {f.name}
                    </td>
                    <td className="px-4 py-2">
                      <FieldBadge type={f.type} />
                    </td>
                    <td className="px-4 py-2 text-staleks-muted">{f.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Screenshot
            src="/guide/05-fields.png"
            alt="Вкладка Поля"
            caption="54 активных поля — параметры конфигурации дверей"
          />

          <Tip>
            На вкладке «Поля» ты видишь все поля с их типом, группой и
            статусом. Поля можно фильтровать по типу двери (Техническая / С
            Отделкой) и по секции.
          </Tip>
        </section>

        {/* ── Section 6: Видимость ─────────────────────────────────────── */}
        <section id="visibility" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            6. Правила видимости (9 правил)
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Умные поля — появляются только когда нужны
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed">
            Нажми вкладку <strong>«Видимость (9)»</strong>. Правила видимости
            — это логика, которая говорит системе: «показывай поле X только
            если поле Y имеет значение Z». Это делает форму конфигуратора
            умной — менеджер видит только те поля, которые актуальны для
            конкретной двери.
          </p>

          <h3 className="text-lg font-semibold text-staleks-sidebar mb-3">
            Примеры правил
          </h3>

          <div className="space-y-4 mb-6">
            {[
              {
                trigger: 'Кол-во створок = "2 створки"',
                shows: "Створки одинаковые",
                hint: "Только если 2 створки",
                why: 'Если дверь однопольная — незачем спрашивать "одинаковые ли створки"',
              },
              {
                trigger: 'Створки одинаковые = "Нет"',
                shows: "Ширина активной створки",
                hint: "Только если створки разные",
                why: "Если створки разные по размеру — нужно уточнить ширину активной",
              },
              {
                trigger: 'Открывание = "Другое"',
                shows: "Схема открывания",
                hint: "Только если открывание нестандартное",
                why: 'Для стандартного "Правое/Левое" схема очевидна, для "Другое" — нужно уточнение',
              },
              {
                trigger: 'Толщина металла = "Другое"',
                shows: "Толщина короба (мм) + Толщина наружного металла + Толщина внутреннего металла",
                hint: "3 поля — только при нестандартной толщине",
                why: 'При стандартной толщине значения фиксированы, при "Другое" — нужно указать точные мм',
              },
            ].map((rule, i) => (
              <div
                key={i}
                className="p-4 bg-white rounded-xl border border-gray-200"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-staleks-lime/20 text-staleks-sidebar text-sm font-bold flex items-center justify-center">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-500">
                        Когда:
                      </span>
                      <code className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs font-medium">
                        {rule.trigger}
                      </code>
                    </div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-500">
                        Показать:
                      </span>
                      <code className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium">
                        {rule.shows}
                      </code>
                    </div>
                    <p className="text-xs text-staleks-muted">{rule.why}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Screenshot
            src="/guide/06-visibility.png"
            alt="Вкладка Видимость"
            caption="9 правил видимости — логика отображения полей"
          />
        </section>

        {/* ── Section 7: Превью ────────────────────────────────────────── */}
        <section id="preview" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            7. Превью — тестирование
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Проверь как выглядит форма конфигуратора
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed">
            Нажми вкладку <strong>«Превью»</strong>. Это интерактивная форма
            конфигуратора — такая же, какую видит менеджер при создании заказа.
            Здесь ты можешь проверить, правильно ли настроены поля и правила
            видимости.
          </p>

          <h3 className="text-lg font-semibold text-staleks-sidebar mb-3">
            Как проверить правила видимости
          </h3>

          <Step number={1}>
            Выбери тип двери кнопкой: <strong>Техническая</strong> или{" "}
            <strong>С Отделкой</strong>. Форма сразу обновится — количество
            полей изменится (30 или 48).
          </Step>
          <Step number={2}>
            Заполни размеры:{" "}
            <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">
              2050
            </code>{" "}
            мм высота,{" "}
            <code className="bg-gray-100 px-2 py-0.5 rounded text-sm">
              860
            </code>{" "}
            мм ширина.
          </Step>
          <Step number={3}>
            В поле <strong>«Кол-во створок»</strong> выбери{" "}
            <em>«2 створки»</em> — справа появится новое поле{" "}
            <em>«Створки одинаковые»</em> с подсказкой{" "}
            <em>«Только если 2 створки»</em>. Это правило видимости работает!
          </Step>
          <Step number={4}>
            В поле <strong>«Открывание»</strong> выбери <em>«Другое»</em> —
            появится <em>«Схема открывания»</em>. Ещё одно правило.
          </Step>
          <Step number={5}>
            Переключись на <strong>«С Отделкой»</strong> — форма покажет 48
            полей, включая разделы «Наружная отделка» (12 полей) и «Внутренняя
            отделка» (5 полей).
          </Step>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Screenshot
              src="/guide/07-preview-filled.png"
              alt="Превью с заполненной формой"
              caption="Техническая дверь: форма заполнена"
            />
            <Screenshot
              src="/guide/08-preview-rule.png"
              alt="Правило видимости сработало"
              caption="Кол-во = 2 → поле 'Створки одинаковые' появилось"
            />
          </div>

          <Tip>
            Используй Превью каждый раз, когда добавляешь новое правило
            видимости — сразу проверяй, что оно работает корректно.
          </Tip>
        </section>

        {/* ── Section 8: Услуги ────────────────────────────────────────── */}
        <section id="services" className="mb-16 scroll-mt-6">
          <h2 className="text-2xl font-bold text-staleks-sidebar mb-1">
            8. Услуги и финансы
          </h2>
          <p className="text-staleks-muted text-sm mb-6">
            Настройка типов услуг для заказов
          </p>

          <p className="text-gray-700 mb-4 leading-relaxed">
            Нажми вкладку <strong>«Услуги и финансы»</strong>. Здесь ты
            управляешь справочником типов услуг. Менеджер выбирает из этого
            справочника, когда добавляет услуги к заказу (замер, доставка,
            монтаж и т.д.).
          </p>

          <h3 className="text-lg font-semibold text-staleks-sidebar mb-3">
            Способы тарификации (Billing Method)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                method: "Включено в цену",
                color: "bg-green-50 border-green-200 text-green-800",
                badge: "bg-green-100 text-green-700",
                desc: "Услуга входит в стоимость двери. В финансовой сводке не отображается отдельной строкой.",
                example: "Базовая сборка, стандартная покраска",
              },
              {
                method: "Отдельная строка",
                color: "bg-blue-50 border-blue-200 text-blue-800",
                badge: "bg-blue-100 text-blue-700",
                desc: "Услуга прибавляется к итоговой сумме заказа. Менеджер видит её в финансовой сводке.",
                example: "Замер, Доставка, Монтаж",
              },
              {
                method: "Бесплатно",
                color: "bg-gray-50 border-gray-200 text-gray-600",
                badge: "bg-gray-100 text-gray-600",
                desc: "Услуга оказывается бесплатно. Отображается в сводке с нулевой стоимостью.",
                example: "Гарантийное обслуживание",
              },
            ].map((b) => (
              <div
                key={b.method}
                className={`p-4 rounded-xl border ${b.color}`}
              >
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${b.badge}`}
                >
                  {b.method}
                </span>
                <p className="text-sm mb-2">{b.desc}</p>
                <p className="text-xs opacity-70">
                  <em>Пример: {b.example}</em>
                </p>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-semibold text-staleks-sidebar mb-3">
            Как добавить новый тип услуги
          </h3>

          <Step number={1}>
            На вкладке «Услуги и финансы» нажми кнопку{" "}
            <strong>«+ Добавить услугу»</strong>.
          </Step>
          <Step number={2}>
            Заполни поля: <strong>Код</strong> (латиница, например{" "}
            <code className="bg-gray-100 px-1 rounded">delivery</code>),{" "}
            <strong>Название</strong> (например «Доставка»),{" "}
            <strong>Цена по умолчанию</strong> и выбери{" "}
            <strong>Способ тарификации</strong>.
          </Step>
          <Step number={3}>
            Нажми <strong>«Сохранить»</strong>. Новый тип услуги появится в
            списке и станет доступен менеджерам при создании заказов.
          </Step>

          <Screenshot
            src="/guide/09-services.png"
            alt="Вкладка Услуги и финансы"
            caption="Типы услуг — справочник для менеджеров"
          />

          <Note>
            Если пометить услугу как «Обязательная» (is_required), она будет
            автоматически добавляться в каждый новый заказ. Удобно для
            стандартных услуг, которые всегда включены.
          </Note>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-staleks-muted text-sm">
          <p>
            Staleks ERP v2.0 — Руководство Технолога
            <br />
            <a href="/" className="text-staleks-sidebar hover:text-staleks-lime transition-colors mt-2 inline-block">
              Перейти в систему →
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
