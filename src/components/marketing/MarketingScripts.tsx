'use client'

// MarketingScripts — consent-gated GA4, Google Ads, and Meta Pixel tags.
//
// Consent gate guarantee (ADR 0016): when `cookieConsentEnabled` is true,
// scripts only fire after `consented === true`. When the merchant disables
// the consent gate (e.g. a non-EU store), scripts load as soon as IDs are
// present. The default store ships with ALL IDs empty, so the default render
// path produces ZERO marketing scripts — Lighthouse lab score is unaffected.

import Script from 'next/script'
import { useConsent } from '@/lib/consent/ConsentProvider'
import { GA4_ID_RE, GOOGLE_ADS_ID_RE, META_PIXEL_ID_RE } from '@/lib/constants'

export interface MarketingScriptsProps {
  ga4Id: string
  googleAdsId: string
  metaPixelId: string
  cookieConsentEnabled: boolean
}

export function MarketingScripts({
  ga4Id,
  googleAdsId,
  metaPixelId,
  cookieConsentEnabled,
}: MarketingScriptsProps) {
  const { consented } = useConsent()

  // When consent gate is enabled, require explicit acceptance.
  // When disabled (non-EU merchant), allow once IDs are available.
  const allow = cookieConsentEnabled ? consented === true : true

  if (!allow) return null

  // Defense-in-depth: validate IDs against the shared regex constants before
  // interpolating into dangerouslySetInnerHTML script sinks. Guards against
  // out-of-band D1 writes that bypass schema validation.
  const hasGa4 = GA4_ID_RE.test(ga4Id)
  const hasAds = GOOGLE_ADS_ID_RE.test(googleAdsId)
  const hasPixel = META_PIXEL_ID_RE.test(metaPixelId)

  // Nothing configured — renders nothing (preserves Lighthouse lab score).
  if (!hasGa4 && !hasAds && !hasPixel) return null

  // GA4 init script body. When Google Ads is also present it piggybacks on the
  // same gtag loader — one loader, two config calls, no double-load.
  const gtagInitSrc = hasGa4
    ? [
        'window.dataLayer=window.dataLayer||[];',
        'function gtag(){dataLayer.push(arguments);}',
        "gtag('js',new Date());",
        `gtag('config','${ga4Id}');`,
        ...(hasAds ? [`gtag('config','${googleAdsId}');`] : []),
      ].join('')
    : null

  // Ads-only init (GA4 not set).
  const adsOnlyInitSrc =
    !hasGa4 && hasAds
      ? [
          'window.dataLayer=window.dataLayer||[];',
          'function gtag(){dataLayer.push(arguments);}',
          "gtag('js',new Date());",
          `gtag('config','${googleAdsId}');`,
        ].join('')
      : null

  // Meta Pixel inline init.
  const pixelInitSrc = hasPixel
    ? [
        '!function(f,b,e,v,n,t,s){',
        'if(f.fbq)return;n=f.fbq=function(){n.callMethod?',
        'n.callMethod.apply(n,arguments):n.queue.push(arguments)};',
        "if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';",
        'n.queue=[];t=b.createElement(e);t.async=!0;',
        't.src=v;s=b.getElementsByTagName(e)[0];',
        "s.parentNode.insertBefore(t,s)}(window,document,'script',",
        "'https://connect.facebook.net/en_US/fbevents.js');",
        `fbq('init','${metaPixelId}');`,
        "fbq('track','PageView');",
      ].join('')
    : null

  return (
    <>
      {/* GA4 loader + init (also inits Ads if both IDs are set) */}
      {hasGa4 && (
        <>
          <Script
            id="gtag-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
          />
          <Script
            id="gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: gtagInitSrc! }}
          />
        </>
      )}

      {/* Google Ads only (GA4 not set) — load gtag with Ads ID */}
      {!hasGa4 && hasAds && (
        <>
          <Script
            id="gtag-ads-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
          />
          <Script
            id="gtag-ads-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: adsOnlyInitSrc! }}
          />
        </>
      )}

      {/* Meta Pixel inline init + noscript fallback */}
      {hasPixel && (
        <>
          <Script
            id="meta-pixel-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{ __html: pixelInitSrc! }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}
    </>
  )
}
