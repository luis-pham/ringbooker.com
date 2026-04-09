export const metadata = {
  title: 'FAQ',
};

export default function FaqPage() {
  return (
    <main style={{ maxWidth: 860, margin: '40px auto', padding: 16 }}>
      <h1>Frequently Asked Questions</h1>
      <p>RingBooker answers calls, checks availability, books appointments, and sends follow-up messages.</p>
      <h2>Does RingBooker take payments?</h2>
      <p>Not in this MVP. Subscription billing is handled by Paddle only.</p>
      <h2>Can I route escalations to user?</h2>
      <p>Yes. Transfer and callback workflows are supported in backend flows.</p>
    </main>
  );
}
