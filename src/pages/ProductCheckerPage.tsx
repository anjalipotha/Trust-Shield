import React, { useState } from 'react';
import { UserProfile } from '../types';
import { analyzeProductApi, ProductAnalysisResponse } from '../lib/api';
import { saveScan } from '../lib/supabase';
import { RiskBadge } from '../components/RiskBadge';
import { RiskGauge } from '../components/RiskGauge';
import {
  ShoppingBag,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  DollarSign,
  Store,
  FileText,
  RotateCcw,
} from 'lucide-react';

interface ProductCheckerPageProps {
  user: UserProfile;
}

export const ProductCheckerPage: React.FC<ProductCheckerPageProps> = ({ user }) => {
  const [productName, setProductName] = useState('');
  const [listingUrl, setListingUrl] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [advertisedPrice, setAdvertisedPrice] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductAnalysisResponse | null>(null);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Please provide the product name to evaluate.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);
    setSavedScanId(null);

    try {
      const data = await analyzeProductApi({
        product_name: productName.trim(),
        listing_url: listingUrl.trim(),
        seller_name: sellerName.trim(),
        advertised_price: advertisedPrice.trim(),
        product_description: productDescription.trim(),
        additional_context: additionalContext.trim(),
      });
      setResult(data);

      // Save to scans repository
      const saved = await saveScan({
        user_id: user.id,
        scan_type: 'product',
        input_summary: `${productName} (${advertisedPrice || 'Price unlisted'})`,
        risk_level: data.analysis.risk_level,
        risk_score: data.analysis.risk_score,
        status: 'completed',
        result_summary: data.analysis.summary,
        details: {
          product_name: productName,
          seller_name: sellerName,
          advertised_price: advertisedPrice,
          warning_signs: data.analysis.warning_signs,
          verification_tips: data.analysis.verification_tips,
        },
      });
      setSavedScanId(saved.id);
    } catch (err: any) {
      setError(err.message || 'Error occurred during product scam analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setProductName('');
    setListingUrl('');
    setSellerName('');
    setAdvertisedPrice('');
    setProductDescription('');
    setAdditionalContext('');
    setResult(null);
    setError(null);
    setSavedScanId(null);
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-amber-400" />
          <span>Product & Online Storefront Scam Checker</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Evaluate e-commerce listings, impossible discount claims, counterfeit red flags, and non-delivery merchant patterns.
        </p>
      </div>

      {/* Advisory Banner */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
        <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Objective Evidentiary Discipline:</strong> TrustShield does not definitively declare storefronts counterfeit without conclusive physical investigation. When public corporate registries or escrow records are missing, assessments are labeled <span className="font-semibold text-slate-200">"Inconclusive"</span> and provided with actionable buyer verification checklists.
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Product Name / Claimed Item *
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Apple iPhone 16 Pro Max 512GB"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Advertised Price
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={advertisedPrice}
                  onChange={(e) => setAdvertisedPrice(e.target.value)}
                  placeholder="e.g. $199 (Original MSRP: $1,399)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Seller / Storefront Name
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="e.g. MegaDiscountsGlobal LLC / @luxury_deals_direct"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Storefront Listing URL
              </label>
              <input
                type="text"
                value={listingUrl}
                onChange={(e) => setListingUrl(e.target.value)}
                placeholder="https://exclusive-electronics-discount-deal.shop/product"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Product Description & Seller Claims
            </label>
            <textarea
              rows={3}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="e.g. Warehouse clearance, brand new sealed in box. 90% discount due to overstock. Requires direct payment via wire or gift card to unlock discounted inventory..."
              className="w-full p-3 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Additional Observations & Payment Methods Mentioned
            </label>
            <input
              type="text"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="e.g. Seller insists on Zelle or cryptocurrency; refuses credit card or PayPal buyer protection."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-md text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="submit"
              disabled={analyzing || !productName.trim()}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md transition-colors shadow-sm shadow-sky-600/30 flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>Evaluating Scam Indicators...</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>Analyze Product Scam Risk</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Result Section */}
      {result && (
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-lg p-5 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <RiskBadge level={result.analysis.risk_level} score={result.analysis.risk_score} />
                <span className="text-xs text-slate-500 font-mono">
                  {sellerName ? `Seller: ${sellerName}` : 'Seller Unspecified'}
                </span>
              </div>
              <h3 className="text-base font-bold text-white">
                {result.analysis.summary}
              </h3>
            </div>

            <div className="w-full md:w-64 shrink-0">
              <RiskGauge score={result.analysis.risk_score} level={result.analysis.risk_level} />
            </div>
          </div>

          {/* Payment Risk Warning */}
          {result.analysis.payment_risk_warning && (
            <div className="p-3.5 bg-rose-950/30 border border-rose-800/40 rounded-lg text-xs text-rose-300 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-rose-200">Payment Security Warning:</strong>{' '}
                {result.analysis.payment_risk_warning}
              </div>
            </div>
          )}

          {/* Warning Signs */}
          {result.analysis.warning_signs && result.analysis.warning_signs.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2.5">
                Observed Scam Red Flags ({result.analysis.warning_signs.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.analysis.warning_signs.map((sign, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-900/60 border border-slate-800 rounded flex items-start gap-2 text-xs text-slate-200"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{sign}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification Tips */}
          {result.analysis.verification_tips && result.analysis.verification_tips.length > 0 && (
            <div>
              <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold mb-2.5">
                Recommended Manual Verification Steps
              </h4>
              <div className="space-y-2">
                {result.analysis.verification_tips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900/60 border border-slate-800 rounded flex items-start gap-2.5 text-xs text-slate-300"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="p-3 bg-slate-900/40 border border-slate-800/80 rounded text-xs text-slate-400">
            <strong className="text-slate-300">Forensic Disclaimer:</strong>{' '}
            {result.analysis.limitations ||
              'Scam risk is assessed based on advertised pricing, domain structure, and described fulfillment terms. Authentic merchants occasionally run sales, and sophisticated scammers use authentic photos.'}
          </div>

          <div className="pt-3 border-t border-slate-800 text-xs text-slate-500 font-mono">
            {savedScanId ? `Check Registered in Database: ${savedScanId}` : 'Database Logged'}
          </div>
        </div>
      )}
    </div>
  );
};
