const $ = (s) => document.querySelector(s);
const uidInput = $('#uid');
const findButton = $('#find-player');
const playerState = $('#player-state');
const packagesSection = $('#step-packages');
const reviewSection = $('#step-review');
const continueButton = $('#continue-button');
const paymentState = $('#payment-state');
const payerNameInput = $('#payer-name');
const payerCpfInput = $('#payer-cpf');
const toast = $('#toast');

let player = null;
let selectedPackage = null;
let currentOrderId = null;
let pollTimer = null;
let confirmRegular = false;
let playerConfirmed = false;
let audioCtx = null;

function clickSound(kind = 'soft') {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(kind === 'success' ? 640 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'success' ? 820 : 310, now + .045);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(kind === 'success' ? .035 : .022, now + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .07);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + .075);
  } catch {}
}

document.addEventListener('click', (e) => {
  if (e.target.closest('button,.primary')) clickSound('soft');
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function revealSection(section) {
  section.classList.remove('hidden-stage');
  section.setAttribute('aria-disabled', 'false');
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 90);
}

function hideSection(section) {
  section.classList.add('hidden-stage');
  section.setAttribute('aria-disabled', 'true');
}

function resetAfterPlayer() {
  selectedPackage = null;
  currentOrderId = null;
  confirmRegular = false;
  playerConfirmed = false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  paymentState.className = 'payment-state hidden';
  paymentState.innerHTML = '';
  document.querySelectorAll('.package').forEach((b) => b.classList.remove('selected'));
  hideSection(packagesSection);
  hideSection(reviewSection);
  continueButton.disabled = true;
  continueButton.querySelector('span:first-child').textContent = 'Gerar PIX';
  $('#summary-pack').textContent = '—';
  $('#summary-price').textContent = '—';
  $('#summary-discount').textContent = '30% OFF';
}

async function findPlayer() {
  const uid = uidInput.value.replace(/\D/g, '').trim();
  uidInput.value = uid;

  if (uid.length < 6) {
    playerState.className = 'player-state error';
    playerState.textContent = 'Digite um ID numérico válido.';
    playerState.classList.remove('hidden');
    return;
  }

  findButton.disabled = true;
  playerState.className = 'player-state loading';
  playerState.textContent = 'Localizando sua conta…';
  playerState.classList.remove('hidden');

  try {
    const response = await fetch(`/api/player?uid=${encodeURIComponent(uid)}&region=BR`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível localizar esse jogador.');

    player = data.player;
    resetAfterPlayer();
    playerState.className = 'player-state';
    playerState.innerHTML = `
      <div class="player-card">
        <div class="avatar">${escapeHtml(String(player.nickname || '?').trim().slice(0,1).toUpperCase())}</div>
        <div class="player-meta"><strong>${escapeHtml(player.nickname)}</strong><small>ID ${escapeHtml(player.uid)} · ${escapeHtml(player.region)}${player.level ? ` · Nível ${escapeHtml(String(player.level))}` : ''}</small></div>
        <span class="verified">CONTA ENCONTRADA</span>
      </div>
      <div class="account-confirm">
        <p>Esse é o seu nome de usuário?</p>
        <div class="confirm-actions">
          <button id="confirm-account" class="confirm-primary" type="button">Sim, continuar <span>→</span></button>
          <button id="edit-id" class="confirm-secondary" type="button">Não, corrigir ID</button>
        </div>
      </div>`;
    $('#summary-player').textContent = player.nickname;
    $('#summary-uid').textContent = player.uid;
    clickSound('success');

    $('#confirm-account')?.addEventListener('click', () => {
      playerConfirmed = true;
      playerState.classList.add('confirmed');
      const confirmBox = playerState.querySelector('.account-confirm');
      if (confirmBox) confirmBox.innerHTML = '<div class="confirmed-line">✓ Conta confirmada</div>';
      clickSound('success');
      revealSection(packagesSection);
    });

    $('#edit-id')?.addEventListener('click', () => {
      player = null;
      playerConfirmed = false;
      hideSection(packagesSection);
      hideSection(reviewSection);
      playerState.className = 'player-state hidden';
      playerState.innerHTML = '';
      uidInput.focus();
      uidInput.select();
    });
  } catch (err) {
    player = null;
    hideSection(packagesSection);
    hideSection(reviewSection);
    playerState.className = 'player-state error';
    playerState.textContent = err.message || 'Não foi possível consultar esse ID agora.';
  } finally {
    findButton.disabled = false;
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

findButton.addEventListener('click', findPlayer);
uidInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') findPlayer(); });
uidInput.addEventListener('input', () => { uidInput.value = uidInput.value.replace(/\D/g, ''); });

document.querySelectorAll('.package').forEach((button) => {
  button.addEventListener('click', () => {
    if (!player || !playerConfirmed) return;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    currentOrderId = null;
    confirmRegular = false;
    paymentState.className = 'payment-state hidden';
    paymentState.innerHTML = '';
    continueButton.querySelector('span:first-child').textContent = 'Gerar PIX';
    $('#summary-discount').textContent = '30% OFF';
    document.querySelectorAll('.package').forEach((b) => b.classList.remove('selected'));
    button.classList.add('selected');
    selectedPackage = { diamonds: Number(button.dataset.diamonds), price: Number(button.dataset.price) };
    $('#summary-pack').textContent = `${selectedPackage.diamonds.toLocaleString('pt-BR')} diamantes`;
    $('#summary-price').textContent = selectedPackage.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    continueButton.disabled = false;
    revealSection(reviewSection);
  });
});

function formatCpf(value) {
  const d = String(value || '').replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}
payerCpfInput.addEventListener('input', () => { payerCpfInput.value = formatCpf(payerCpfInput.value); });

function renderPix(data) {
  currentOrderId = data.order_id;
  const amount = (Number(data.amount_cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  $('#summary-price').textContent = amount;
  $('#summary-discount').textContent = data.promotion?.first_recharge ? '30% OFF' : 'Sem desconto';
  paymentState.className = 'payment-state';
  const qrImage = data.charge?.qr_code_image ? `<img src="${escapeHtml(data.charge.qr_code_image)}" alt="QR Code PIX">` : '';
  paymentState.innerHTML = `
    <div class="pix-card">
      <strong>PIX gerado</strong>
      <div class="pay-status">Status: <strong>aguardando pagamento</strong></div>
      ${qrImage}
      <div class="pix-code"><textarea id="pix-copy" readonly>${escapeHtml(data.charge?.qr_code || '')}</textarea><button id="copy-pix" type="button">Copiar</button></div>
      <div class="order-code">Pedido ${escapeHtml(data.order_id)}</div>
    </div>`;
  $('#copy-pix')?.addEventListener('click', async () => {
    const code = data.charge?.qr_code || '';
    try { await navigator.clipboard.writeText(code); showToast('PIX copiado.'); }
    catch { $('#pix-copy')?.select(); showToast('Selecione e copie o código.'); }
  });
  continueButton.disabled = true;
  continueButton.querySelector('span:first-child').textContent = 'PIX gerado';
  clickSound('success');
  startStatusPolling();
}

async function checkOrderStatus() {
  if (!currentOrderId) return;
  try {
    const r = await fetch(`/api/payment-status?order_id=${encodeURIComponent(currentOrderId)}`);
    const data = await r.json();
    if (!r.ok || !data.ok) return;
    const status = data.order?.payment_status;
    const statusEl = paymentState.querySelector('.pay-status strong');
    if (statusEl) statusEl.textContent = status === 'paid' ? 'pagamento aprovado' : status === 'expired' ? 'PIX expirado' : 'aguardando pagamento';
    if (status === 'paid') {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      paymentState.className = 'payment-state success';
      paymentState.innerHTML = `<div class="pix-card"><strong>Pagamento aprovado</strong><p class="pay-status">Seu pedido está <strong>pago — aguardando entrega manual</strong>.</p><div class="order-code">Pedido ${escapeHtml(currentOrderId)}</div></div>`;
      clickSound('success');
    } else if (status === 'expired' || status === 'failed') {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      continueButton.disabled = false;
      continueButton.querySelector('span:first-child').textContent = 'Gerar novo PIX';
    }
  } catch {}
}

function startStatusPolling() {
  if (pollTimer) clearInterval(pollTimer);
  checkOrderStatus();
  pollTimer = setInterval(checkOrderStatus, 5000);
}

continueButton.addEventListener('click', async () => {
  if (!player || !selectedPackage) return;
  const payerName = payerNameInput.value.trim();
  const payerDocument = payerCpfInput.value.replace(/\D/g, '');
  if (payerName.length < 3) return showToast('Informe o nome do pagador.');
  if (payerDocument.length !== 11) return showToast('Informe um CPF válido.');

  continueButton.disabled = true;
  continueButton.querySelector('span:first-child').textContent = 'Gerando PIX…';
  paymentState.className = 'payment-state';
  paymentState.textContent = 'Criando cobrança…';

  try {
    const response = await fetch(`/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: player.uid, nickname: player.nickname, region: player.region, diamonds: selectedPackage.diamonds, payer_name: payerName, payer_document: payerDocument, confirm_regular: confirmRegular })
    });
    const data = await response.json();

    if (response.status === 409 && data.code === 'discount_not_eligible') {
      confirmRegular = true;
      const regular = (Number(data.amount_cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      $('#summary-discount').textContent = 'Já utilizado';
      $('#summary-price').textContent = regular;
      paymentState.className = 'payment-state error';
      paymentState.textContent = `A promoção já foi utilizada neste CPF. O valor normal é ${regular}. Toque novamente para continuar sem desconto.`;
      continueButton.disabled = false;
      continueButton.querySelector('span:first-child').textContent = `Gerar PIX de ${regular}`;
      return;
    }

    if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível gerar o PIX.');
    confirmRegular = false;
    renderPix(data);
  } catch (err) {
    paymentState.className = 'payment-state error';
    paymentState.textContent = err.message || 'Não foi possível gerar o PIX agora.';
    continueButton.disabled = false;
    continueButton.querySelector('span:first-child').textContent = confirmRegular ? 'Gerar PIX sem desconto' : 'Gerar PIX';
  }
});
