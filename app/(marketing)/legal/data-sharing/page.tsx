export const metadata = {
  title: "信息分享说明 · LionHome",
};

export default function DataSharingPage() {
  return (
    <article className="prose prose-sm prose-neutral mx-auto max-w-2xl space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-xs tracking-widest text-neutral-500 uppercase">
          Data Sharing · 信息分享
        </p>
        <h1 className="text-2xl font-semibold">信息分享说明</h1>
        <p className="text-xs text-neutral-500">
          最近更新：{new Date().toISOString().split("T")[0]}
        </p>
      </header>

      <section className="space-y-2">
        <p className="text-sm leading-relaxed text-neutral-700">
          当你在测算页面主动选择「找顾问帮我看这个区间的房」类操作时， LionHome
          会与一位合作中介分享你的测算信息。本页详细列出分享的范围、目的和你的权利。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. 分享给谁</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          仅分享给<strong>新加坡 CEA（Council for Estate Agencies）注册的合作中介</strong>，
          且是与你画像（身份、预算区间、购买时间线）匹配的一位。我们不向多家中介同时披露。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. 分享什么数据</h2>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>身份类型（公民/PR/外籍）；</li>
          <li>家庭收入区间、现金区间、CPF 区间（不分享精确数字）；</li>
          <li>测算得出的房价区间和现金需求；</li>
          <li>购买时间线（半年内 / 1 年内 / 1 年以上）；</li>
          <li>你提供的联系方式（姓名、WhatsApp / 手机号）。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. 分享目的</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          让中介在第一次接触你时已经理解你的画像，避免重复填写问卷或被推荐与预算不符的房源。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. 中介如何使用</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          合作中介与 LionHome 签有数据处理约定，约束他们：
        </p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>仅将你的信息用于本次咨询与跟进；</li>
          <li>不得转售或转交给第三方；</li>
          <li>不得发送你未同意的促销信息。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. 你的权利</h2>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>
            <strong>默认不分享</strong>：你必须明确勾选同意框才会触发分享；
          </li>
          <li>
            <strong>随时撤回</strong>：联系 LionHome 撤回后，我们将通知合作中介停止使用，
            并请求其删除已转交的信息；
          </li>
          <li>
            <strong>不分享也能使用</strong>：测算工具本身完全免费且不需要同意分享。
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. 投诉</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          若你认为合作中介违反约定，可通过工具内 WhatsApp 入口告知 LionHome，
          我们将停止与该中介合作；亦可直接向{" "}
          <a
            href="https://www.cea.gov.sg"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            CEA
          </a>{" "}
          或{" "}
          <a
            href="https://www.pdpc.gov.sg"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            PDPC
          </a>{" "}
          投诉。
        </p>
      </section>
    </article>
  );
}
