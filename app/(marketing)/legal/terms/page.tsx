export const metadata = {
  title: "使用条款 · LionHome",
};

export default function TermsPage() {
  return (
    <article className="prose prose-sm prose-neutral mx-auto max-w-2xl space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-xs tracking-widest text-neutral-500 uppercase">
          Terms of Use · 使用条款
        </p>
        <h1 className="text-2xl font-semibold">LionHome 使用条款</h1>
        <p className="text-xs text-neutral-500">
          最近更新：{new Date().toISOString().split("T")[0]}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">1. 关于本工具</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          LionHome（以下称「本工具」或「我们」）是一个面向新加坡华语购房者的预算测算工具。
          本工具基于公开的 IRAS、MAS 及 URA 数据进行测算，仅供参考。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">2. 信息免责声明</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本工具提供的所有数字（房价区间、月供、印花税、break-even 等）均为
          <strong>初步参考估算</strong>，基于一系列简化假设。这些数字：
        </p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>
            <strong>不构成</strong>财务、税务、法律、投资或专业建议；
          </li>
          <li>
            <strong>不替代</strong>持牌房产中介（CEA）、银行、律师或税务顾问的咨询；
          </li>
          <li>
            <strong>可能与</strong>银行实际审批结果、IRAS 实际税务处理结果有差异；
          </li>
          <li>
            适用范围限于<strong>新加坡私人住宅银行贷款</strong>
            。HDB、EC、商业地产、海外房产不在覆盖范围。
          </li>
        </ul>
        <p className="text-sm leading-relaxed text-neutral-700">
          你在做任何实际购房决策（包括但不限于支付订金、签署 OTP、提交贷款申请）前，
          必须独立向持牌专业人士核实数字与法规适用性。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">3. 不提供任何担保</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本工具以「AS-IS」方式提供，<strong>不提供任何明示或暗示的担保</strong>，包括但不限于：
          准确性、完整性、可靠性、特定用途适用性、不侵权等。我们不保证：
        </p>
        <ul className="list-disc pl-5 text-sm leading-relaxed text-neutral-700">
          <li>工具的输出与新加坡现行法规或税率完全一致；</li>
          <li>工具持续可用、无中断或无错误；</li>
          <li>工具引用的第三方信息（如 URA PPI、租金中位数）当前有效。</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">4. 责任上限</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          在适用法律允许的最大范围内，LionHome 对你因使用本工具产生的任何直接、间接、附带、
          特殊或后果性损失（包括但不限于错误决策导致的财务损失、订金没收、错失购房机会、
          利息损失），<strong>不承担任何责任</strong>。
        </p>
        <p className="text-sm leading-relaxed text-neutral-700">
          由于本工具免费提供，我们对任何索赔的责任总额上限为 <strong>SGD 0</strong>。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">5. 数据使用</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          你提供的测算输入（如收入区间、现金、CPF 余额、身份等）的处理方式详见
          <a href="/legal/privacy" className="underline">
            隐私政策
          </a>
          。仅在你主动选择「联系顾问」时，我们才会保存测算结果并联系你；
          分享给合作中介前，会单独征求你的明示同意。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">6. 第三方链接</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本工具可能链接到 IRAS、MAS、URA、合作中介页面或 WhatsApp 等第三方服务。
          我们不对第三方内容或服务负责，使用第三方服务受其自身条款约束。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">7. 知识产权</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本工具的所有内容、算法、设计、文案均属 LionHome 所有。未经书面许可，不得复制、
          转载、改编或商业使用。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">8. 适用法律</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          本条款适用新加坡法律。任何争议应优先通过友好协商解决。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">9. 条款变更</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          我们保留随时修改本条款的权利。重要变更将在工具首页公告。继续使用本工具即视为
          接受变更后的条款。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">10. 联系我们</h2>
        <p className="text-sm leading-relaxed text-neutral-700">
          如对本条款有疑问，可通过工具内 WhatsApp 入口联系 LionHome。
        </p>
      </section>

      <hr className="border-neutral-200" />
      <p className="text-xs text-neutral-500">使用本工具即表示你已阅读、理解并同意以上全部条款。</p>
    </article>
  );
}
