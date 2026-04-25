import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardCheck,
  FaCreditCard,
  FaExternalLinkAlt,
  FaHeadset,
  FaLock,
  FaShieldAlt,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import { HiOutlineBanknotes } from "react-icons/hi2";

import { useCart } from "../cart/CartContext";
import { getUserActionErrorMessage, USER_MESSAGES } from "../lib/userMessages";
import { useToast } from "../toast/ToastContext";
import type { PaymentProvider } from "../lib/commerceApi";
import { formatPrice, getFormatLabel } from "../lib/format";

const CHECKOUT_STEPS_TARA = [
  { value: "01", title: "Vérification", copy: "Vérifiez votre commande.", icon: FaClipboardCheck },
  { value: "02", title: "Redirection Tara", copy: "Le paiement s'ouvre sur Tara Money.", icon: FaExternalLinkAlt },
  { value: "03", title: "Activation", copy: "Vos accès s'ouvrent après confirmation.", icon: FaLock },
] as const satisfies ReadonlyArray<{ value: string; title: string; copy: string; icon: IconType }>;

const CHECKOUT_STEPS_STRIPE = [
  { value: "01", title: "Vérification", copy: "Vérifiez votre commande.", icon: FaClipboardCheck },
  { value: "02", title: "Paiement carte", copy: "Paiement sécurisé via Stripe.", icon: FaCreditCard },
  { value: "03", title: "Activation", copy: "Vos accès s'ouvrent après confirmation.", icon: FaLock },
] as const satisfies ReadonlyArray<{ value: string; title: string; copy: string; icon: IconType }>;

function getCheckoutSummaryLabel(title: string): string {
  const normalized = title.trim();
  const compact = normalized.split(/[,(]/)[0]?.trim() || normalized;

  if (compact.length <= 38) {
    return compact;
  }

  return `${compact.slice(0, 35).trimEnd()}…`;
}

function getPreviewSchedule(
  schedules: Record<string, { amount: number; amount_label: string; due_date: string; number: number }[]>,
  formationSlug: string,
) {
  return schedules[formationSlug] ?? [];
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, isLoading, addToCart, checkout } = useCart();
  const { success, error: showErrorToast } = useToast();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingIntent, setIsResolvingIntent] = useState(false);
  const [error, setError] = useState("");
  const [useInstallments, setUseInstallments] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>("tara");
  const requestedSlug = searchParams.get("add");

  useEffect(() => {
    if (!requestedSlug || isLoading) return;
    if (cart.items.some((item) => item.formation_slug === requestedSlug)) {
      navigate("/checkout", { replace: true });
      return;
    }

    let isMounted = true;
    setIsResolvingIntent(true);
    setError("");

    addToCart(requestedSlug)
      .then(() => {
        if (!isMounted) return;
        success(USER_MESSAGES.cartAdded);
        navigate("/checkout", { replace: true });
      })
      .catch((e) => {
        if (!isMounted) return;
        const message = getUserActionErrorMessage(e, "checkout.prepare");
        setError(message);
        showErrorToast(message);
      })
      .finally(() => {
        if (isMounted) {
          setIsResolvingIntent(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [addToCart, cart.items, isLoading, navigate, requestedSlug, showErrorToast, success]);

  useEffect(() => {
    if (!isLoading && !isResolvingIntent && cart.items.length === 0 && !requestedSlug) {
      navigate("/panier", { replace: true });
    }
  }, [cart.items.length, isLoading, isResolvingIntent, navigate, requestedSlug]);

  useEffect(() => {
    if (!cart.allow_installments && useInstallments) {
      setUseInstallments(false);
    }
  }, [cart.allow_installments, useInstallments]);

  const installmentSchedules = cart.installment_schedules_preview ?? {};
  const maxInstallmentCount = useMemo(
    () =>
      Math.max(
        0,
        ...Object.values(installmentSchedules).map((schedule) => schedule.length),
      ),
    [installmentSchedules],
  );

  const total = cart.total_amount;
  const isInstallmentEligible = cart.allow_installments && maxInstallmentCount > 1;
  const canUseInstallments = isInstallmentEligible;
  const useInstallmentsNow = canUseInstallments && useInstallments;
  const installmentDueToday = isInstallmentEligible
    ? cart.items.reduce((sum, item) => {
        const schedule = getPreviewSchedule(installmentSchedules, item.formation_slug);
        return sum + (schedule[0]?.amount ?? item.current_price_amount);
      }, 0)
    : total;
  const dueToday = useInstallmentsNow ? installmentDueToday : total;
  const remainingAfterToday = Math.max(total - dueToday, 0);
  const previewItems = cart.items.slice(0, 3);
  const thresholdLabel =
    cart.installment_threshold_label || formatPrice(cart.installment_threshold_amount);
  const isBelowInstallmentThreshold = total < cart.installment_threshold_amount || !cart.allow_installments;
  const installmentChoiceTitle = isInstallmentEligible
    ? "Activer le paiement échelonné"
    : "Paiement échelonné indisponible";
  const installmentChoiceCopy = isInstallmentEligible
    ? paymentProvider === "stripe"
      ? `Environ ${formatPrice(installmentDueToday)} encaissés aujourd'hui par carte — les versements suivants seront payables depuis votre espace étudiant.`
      : `Environ ${formatPrice(installmentDueToday)} encaissés aujourd'hui — les versements suivants sont répartis selon la durée réelle de votre session.`
    : isBelowInstallmentThreshold
      ? `Disponible à partir de ${thresholdLabel} de commande.`
      : "Aucun échéancier n'est disponible pour ces formations, probablement parce que la session est trop proche.";

  const formatTags = [
    cart.live_items_count > 0 ? `${cart.live_items_count} live` : null,
    cart.ligne_items_count > 0 ? `${cart.ligne_items_count} en ligne` : null,
    cart.presentiel_items_count > 0 ? `${cart.presentiel_items_count} présentiel` : null,
  ].filter(Boolean);

  const handleCheckout = async () => {
    setError("");
    setIsSubmitting(true);

    try {
      const result = await checkout({
        useInstallments: useInstallmentsNow,
        paymentMode: useInstallmentsNow ? "installments" : "full",
        paymentProvider,
      });
      success(result.message);

      const externalUrl =
        result.external_redirect_url ??
        result.payment_links?.dikalo_link ??
        result.payment_links?.whatsapp_link ??
        result.payment_links?.telegram_link ??
        result.payment_links?.sms_link ??
        null;

      if (externalUrl) {
        window.location.assign(externalUrl);
        return;
      }

      navigate(result.redirect_path, {
        replace: true,
        state: { checkoutMessage: result.message },
      });
    } catch (e) {
      const message = getUserActionErrorMessage(e, "checkout.submit");
      setError(message);
      showErrorToast(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInstallmentToggle = (checked: boolean) => {
    setUseInstallments(checked);
  };

  if (isLoading || isResolvingIntent) {
    return (
      <div className="page-surface--commerce">
        <div className="page page--narrow">
          <section className="auth-card auth-card--centered">
            <p className="eyebrow">Paiement</p>
            <h1>{requestedSlug ? "Préparation du paiement…" : "Chargement…"}</h1>
          </section>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return null;
  }

  return (
    <div className="page-surface--commerce">
      <div className="page commerce-page">
        <section className="section-heading section-heading--spaced">
        <p className="eyebrow">Paiement sécurisé</p>
        <h1>Finalisez votre inscription</h1>
        <p className="page-intro">
          Vérifiez le montant à encaisser, activez le paiement échelonné dès{" "}
          {thresholdLabel} de commande si besoin, puis finalisez le règlement
          avec la passerelle sélectionnée.
        </p>
      </section>

        <section className="ckout-masthead">
          <aside className="ckout-masthead__panel">
          <div className="ckout-masthead__steps" aria-label="Étapes de paiement">
            {(paymentProvider === "stripe" ? CHECKOUT_STEPS_STRIPE : CHECKOUT_STEPS_TARA).map((step) => {
              const StepIcon = step.icon;
              return (
                <article className="ckout-mini-step" key={step.title}>
                  <div className="ckout-mini-step__icon-shell" aria-hidden="true">
                    <StepIcon />
                  </div>
                  <span className="ckout-mini-step__value">{step.value}</span>
                  <strong>{step.title}</strong>
                  <p>{step.copy}</p>
                </article>
              );
            })}
          </div>
          </aside>
        </section>

        <div className="cart-layout ckout-layout">
          <div className="cart-items">
          <div className="ckout-section-head">
            <div>
              <p className="ckout-section-head__eyebrow">Commande</p>
              <h2 className="ckout-col-title">Formations sélectionnées</h2>
            </div>
            <span className="ckout-section-head__aside">
              {useInstallmentsNow ? "Paiement échelonné" : "Paiement unique"}
            </span>
          </div>

          {cart.items.map((item) => {
            const schedule = getPreviewSchedule(installmentSchedules, item.formation_slug);
            const firstInstallment = schedule[0]?.amount ?? item.current_price_amount;

            return (
              <article className="ckout-item" key={item.id}>
                <div className="ckout-item__img">
                  <img src={item.image} alt={item.title} />
                </div>
                <div className="ckout-item__body">
                  <div className="ckout-item__badges">
                    <span className="cart-item-card__mode">{getFormatLabel(item.format_type)}</span>
                  </div>
                  <h3 className="ckout-item__title">{item.title}</h3>
                  {item.session_label && (
                    <p className="ckout-item__session">{item.session_label}</p>
                  )}
                  <div className="ckout-item__meta">
                    <span>{item.level}</span>
                    <span>
                      {item.dashboard_type === "guided"
                        ? "Espace guidé"
                        : "Espace classique"}
                    </span>
                  </div>
                </div>
                <div className="ckout-item__price">
                  <strong>{item.current_price_label}</strong>
                  {useInstallmentsNow && (
                    <span className="ckout-item__installment-copy">
                      Aujourd&apos;hui {formatPrice(firstInstallment)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}

          <div className="ckout-installment-zone">
            <div
              className={`ckout-installment-choice${useInstallmentsNow ? " is-selected" : ""}${!isInstallmentEligible ? " is-disabled" : ""}`}
            >
              <label className="ckout-installment-choice__toggle">
                <input
                  type="checkbox"
                  checked={useInstallmentsNow}
                  disabled={!isInstallmentEligible}
                  onChange={(event) => handleInstallmentToggle(event.target.checked)}
                />
                <div className="ckout-installment-choice__copy">
                  <p className="ckout-installment-choice__eyebrow">Option de paiement</p>
                  <strong>{installmentChoiceTitle}</strong>
                  <p>{installmentChoiceCopy}</p>
                </div>
              </label>

              {useInstallmentsNow && (
                <div className="ckout-schedule ckout-order-schedule">
                  <div className="ckout-schedule__row">
                    <HiOutlineBanknotes className="ckout-schedule__icon" />
                    <span>Aujourd'hui</span>
                    <strong>~{formatPrice(dueToday)}</strong>
                  </div>
                  <div className="ckout-schedule__row ckout-schedule__row--note">
                    <FaCalendarAlt className="ckout-schedule__icon" />
                    <span>Versements suivants répartis selon la durée de la formation — le détail exact s'affiche dans votre espace paiements après confirmation.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ckout-note-grid">
            <div className="ckout-note-card">
              <FaShieldAlt className="ckout-note-card__icon" />
              <div>
                <strong>Inscription garantie</strong>
                <span>Votre place est réservée dès la confirmation du paiement.</span>
              </div>
            </div>
            <div className="ckout-note-card">
              <FaCheckCircle className="ckout-note-card__icon" />
              <div>
                <strong>Accès après confirmation</strong>
                <span>Vos accès sont ouverts dès validation effective du paiement.</span>
              </div>
            </div>
            <div className="ckout-note-card">
              <FaHeadset className="ckout-note-card__icon" />
              <div>
                <strong>Support réactif</strong>
                <span>Notre équipe est disponible pour répondre à vos questions.</span>
              </div>
            </div>
          </div>
          </div>

          <aside className="cart-summary">
            <div className="cart-summary__card ckout-panel">
            <div className="ckout-panel__header">
              <div>
                <p className="ckout-panel__eyebrow">Récapitulatif</p>
                <h2>Règlement de la commande</h2>
              </div>
              <span className="ckout-panel__badge">Sécurisé</span>
            </div>

            <div className="ckout-panel__items">
              {cart.items.map((item) => {
                const schedule = getPreviewSchedule(installmentSchedules, item.formation_slug);
                const firstInstallment = schedule[0]?.amount ?? item.current_price_amount;
                return (
                  <div className="ckout-panel__item-row" key={item.id}>
                    <span className="ckout-panel__item-name" title={item.title}>
                      {getCheckoutSummaryLabel(item.title)}
                    </span>
                    <span className="ckout-panel__item-qty">x1</span>
                    <strong className="ckout-panel__item-price">
                      {useInstallmentsNow
                        ? formatPrice(firstInstallment)
                        : item.current_price_label}
                    </strong>
                  </div>
                );
              })}
            </div>

            <div className="cart-summary__breakdown">
              <div className="cart-summary__row">
                <span style={{ fontWeight: 700, color: "var(--color-navy)" }}>Total commande</span>
                <strong style={{ fontSize: "1.1rem" }}>{formatPrice(total)}</strong>
              </div>
              <div className="cart-summary__row">
                <span>Montant encaissé maintenant</span>
                <strong>{formatPrice(dueToday)}</strong>
              </div>
              {useInstallmentsNow && (
                <div className="cart-summary__row ckout-due-today ckout-due-today--installment">
                  <span>Reste après ce paiement</span>
                  <strong className="ckout-due-today__amount">
                    {formatPrice(remainingAfterToday)}
                  </strong>
                </div>
              )}
            </div>

            {/* ── Provider selector ── */}
            <div className="ckout-provider-selector">
              <p className="ckout-provider-selector__label">Moyen de paiement</p>
              <div className="ckout-provider-selector__options">
                <button
                  type="button"
                  className={`ckout-provider-option${paymentProvider === "tara" ? " is-selected" : ""}`}
                  onClick={() => setPaymentProvider("tara")}
                >
                  <div>
                    <strong><FaExternalLinkAlt className="ckout-provider-option__icon" />Tara Money</strong>
                    <span>Mobile Money & liens de paiement</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`ckout-provider-option${paymentProvider === "stripe" ? " is-selected" : ""}`}
                  onClick={() => setPaymentProvider("stripe")}
                >
                  <div>
                    <strong><FaCreditCard className="ckout-provider-option__icon" />Carte bancaire</strong>
                    <span>Visa, Mastercard — sécurisé par Stripe</span>
                  </div>
                </button>
              </div>
            </div>

            {/* ── Gateway info ── */}
            <div className="ckout-payment-gateway">
              <div className="ckout-payment-gateway__head">
                <div className="ckout-payment-gateway__icon">
                  {paymentProvider === "stripe" ? <FaCreditCard /> : <FaLock />}
                </div>
                <div>
                  <p className="ckout-payment-gateway__eyebrow">Passerelle de paiement</p>
                  <strong>{paymentProvider === "stripe" ? "Stripe — Carte bancaire" : "Tara Money"}</strong>
                </div>
              </div>
              <p className="ckout-payment-gateway__copy">
                {paymentProvider === "stripe"
                  ? "Après validation, vous serez redirigé vers la page de paiement sécurisée Stripe pour régler par carte."
                  : "Après validation, vous serez redirigé vers le lien Tara Money généré pour votre commande."}
              </p>
              {paymentProvider === "tara" && (
                <>
                  <div className="ckout-payment-gateway__mode">
                    <span>Mode sélectionné</span>
                    <strong>
                      {useInstallmentsNow
                        ? `Paiement en ${maxInstallmentCount || 3} tranches`
                        : "Paiement unique"}
                    </strong>
                  </div>
                  <p className="ckout-payment-gateway__hint">
                    {useInstallmentsNow
                      ? "Le premier versement est encaissé maintenant, le solde reste réparti selon le calendrier de la session."
                      : "Le montant total de la commande est encaissé en une seule validation."}
                  </p>
                </>
              )}
              {paymentProvider === "stripe" && (
                <p className="ckout-payment-gateway__hint">
                  {useInstallmentsNow
                    ? "Le premier versement est sécurisé par Stripe. Vos accès sont activés dès confirmation, puis les prochaines tranches restent payables depuis votre espace."
                    : "Paiement intégral sécurisé par Stripe. Vos accès sont activés dès confirmation du paiement."}
                </p>
              )}
            </div>

            {error && <p className="checkout-card__error">{error}</p>}

            <button
              className="button button--primary button--full button--with-arrow"
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void handleCheckout();
              }}
            >
              {isSubmitting
                ? "Traitement en cours…"
                : paymentProvider === "stripe"
                  ? `Payer par carte\u00A0 ${formatPrice(dueToday)}\u00A0`
                  : `Payer\u00A0 ${formatPrice(dueToday)}\u00A0`}
              {!isSubmitting && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>

            <Link className="button button--secondary button--full" to="/panier">
              Modifier le panier
            </Link>

            <div className="cart-summary__features">
              <div className="feature-badge">
                {paymentProvider === "stripe"
                  ? <><FaCreditCard className="feature-badge__icon" /><span>Paiement sécurisé par Stripe</span></>
                  : <><FaExternalLinkAlt className="feature-badge__icon" /><span>Redirection sécurisée vers Tara Money</span></>}
              </div>
            </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
