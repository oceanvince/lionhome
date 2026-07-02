export const metadata = {
  title: "隐私政策 · LionHome",
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-sm prose-neutral mx-auto max-w-2xl space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-xs tracking-widest text-neutral-500 uppercase">
          Privacy Policy · 隐私政策
        </p>
        <h1 className="text-2xl font-semibold">LionHome 隐私政策</h1>
        <p className="text-xs text-neutral-500">
          最近更新：{new Date().toISOString().split("T")[0]}
        </p>
      </header>

      <section className="space-y-2">
        <p className="text-sm leading-relaxed text-neutral-700">
          本隐私政策依据新加坡《个人数据保护法》（PDPA, 2012）撰写，说明 LionHome 如何收集、
          使用、披露和保护你的个人数据。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. 我们收集什么</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          在你使用测算工具时，我们处理以下数据：
        </p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>
            <strong>测算输入</strong>：身份（公民/PR/外籍）、年龄、家庭月收入、可动用现金、CPF
            余额、 持有房产数、购买计划等。这些数据用于计算你的购房预算。
          </li>
          <li>
            <strong>留资信息</strong>（仅在你主动联系顾问时）：姓名、WhatsApp/手机号。
          </li>
          <li>
            <strong>使用日志</strong>：访问时间、设备类型、浏览器类型、IP
            地址（用于安全和性能监控）。
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-neutral-700">
          <strong>我们不会要求</strong>你的 NRIC、护照号、银行账户、信用卡或精确收入数字。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. 何时保存数据</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          <strong>无需注册即可测算</strong>。在你完成测算但未联系顾问的情况下，
          测算输入只在你的浏览器内临时使用，不会持久化到我们的数据库。
        </p>
        <p className="text-sm leading-relaxed text-neutral-700">
          <strong>仅当你主动点击「找顾问」类按钮时</strong>，我们才会保存你的测算输入和结果，
          以便顾问准确理解你的画像并提供针对性建议。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. 我们如何使用数据</h2>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>计算并展示你的购房预算与现金需求；</li>
          <li>在你主动请求联系顾问时，将你的测算结果转交给与你画像匹配的合作中介；</li>
          <li>分析整体使用情况以改进工具（聚合数据，不针对个人）。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. 第三方分享</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          我们<strong>不会出售</strong>你的个人数据。在以下情况下我们会分享数据：
        </p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>
            <strong>合作中介</strong>：仅在你主动请求且明示同意后，将测算结果和联系方式分享给
            一位与你画像匹配的 CEA 注册中介。每次分享都会单独征求同意。
          </li>
          <li>
            <strong>技术服务商</strong>：如托管平台（Vercel）、数据库（Supabase）等。
            这些服务商签有数据处理协议，不会将你的数据用于他途。
          </li>
          <li>
            <strong>法律要求</strong>：在新加坡执法机关或法院依法要求时披露。
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. 数据保留</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          已保存的测算结果保留时长：<strong>留资后 24 个月</strong>，之后自动匿名化处理。
          同意记录（consent log）依 PDPA 要求至少保留 5 年。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. 数据安全</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          我们使用：HTTPS 全程加密传输、Supabase 行级权限控制（RLS）、托管平台基础设施层安全。
          我们尚未实施应用层字段级加密；如果你对此有顾虑，可在留资前评估。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. 你的权利（PDPA）</h2>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>
            <strong>查阅权</strong>：要求我们提供你的个人数据副本；
          </li>
          <li>
            <strong>更正权</strong>：要求更正不准确的数据；
          </li>
          <li>
            <strong>撤销同意权</strong>：可随时撤销同意；撤销后我们将停止使用相应数据，
            并在合理时间内删除（保留依法必须的同意记录除外）；
          </li>
          <li>
            <strong>投诉权</strong>：若认为我们违反 PDPA，可向{" "}
            <a
              href="https://www.pdpc.gov.sg"
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              PDPC（个人数据保护委员会）
            </a>{" "}
            投诉。
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">8. Cookies</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本工具使用必要的会话 Cookie 维持你的测算流程。不使用追踪类第三方 Cookie。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">9. 儿童</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本工具面向成年用户（21 岁以上）。我们不主动收集未成年人数据。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">10. 联系方式</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          如需行使上述权利或对本政策有疑问，可通过工具内 WhatsApp 入口联系 LionHome。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">11. 政策变更</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本政策更新时，我们会在工具首页公告。继续使用即视为接受变更后的政策。
        </p>
      </section>
    </article>
  );
}
