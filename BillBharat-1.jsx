import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────
const SC_MAP = {"01":"J&K","02":"HP","03":"Punjab","04":"Chandigarh","05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"UP","10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur","15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal","20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"MP","24":"Gujarat","27":"Maharashtra","28":"Andhra Pradesh","29":"Karnataka","30":"Goa","32":"Kerala","33":"Tamil Nadu","34":"Puducherry","36":"Telangana","37":"Andhra Pradesh (New)"};
const GST_RATES = [0,0.1,0.25,3,5,12,18,28];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const UNITS = ["pcs","kg","ltr","mtr","hrs","days","box","bag","ton","dozen","set","nos","sqft","sqm","km","ml"];
const PAY_MODES = ["Cash","UPI","NEFT/RTGS","Cheque","Card","Other"];
const EXP_CATS = ["Office Supplies","Travel & Fuel","Food & Dining","Utilities","Rent","Salary","Marketing","Raw Material","Repairs","Transport","Taxes & Fees","Software","Other"];
const ACCENTS = [
  {id:"amber",  name:"Amber",   hex:"#F5A623", dark:"#C17D0E", light:"#FEF3C7"},
  {id:"indigo", name:"Indigo",  hex:"#6366F1", dark:"#4338CA", light:"#EEF2FF"},
  {id:"emerald",name:"Emerald", hex:"#10B981", dark:"#047857", light:"#ECFDF5"},
  {id:"rose",   name:"Rose",    hex:"#F43F5E", dark:"#BE123C", light:"#FFF1F2"},
  {id:"sky",    name:"Sky",     hex:"#0EA5E9", dark:"#0369A1", light:"#F0F9FF"},
  {id:"violet", name:"Violet",  hex:"#8B5CF6", dark:"#6D28D9", light:"#F5F3FF"},
];
const DOC_TYPES = [
  {id:"simple_bill",     label:"Simple Bill",       prefix:"BILL", icon:"🧾", gstOnly:false},
  {id:"tax_invoice",     label:"Tax Invoice",        prefix:"INV",  icon:"📄", gstOnly:true},
  {id:"service_invoice", label:"Service Invoice",    prefix:"SRV",  icon:"⚙️", gstOnly:false},
  {id:"quotation",       label:"Quotation",           prefix:"QUO",  icon:"💬", gstOnly:false},
  {id:"proforma",        label:"Proforma Invoice",    prefix:"PRO",  icon:"📋", gstOnly:false},
  {id:"bill_of_supply",  label:"Bill of Supply",      prefix:"BOS",  icon:"📃", gstOnly:true},
  {id:"credit_note",     label:"Credit Note",          prefix:"CDN",  icon:"↩️", gstOnly:true},
  {id:"debit_note",      label:"Debit Note",            prefix:"DBN",  icon:"↪️", gstOnly:true},
  {id:"delivery_challan",label:"Delivery Challan",    prefix:"DCH",  icon:"🚛", gstOnly:false},
  {id:"purchase_order",  label:"Purchase Order",       prefix:"PO",   icon:"🛒", gstOnly:false},
  {id:"payment_receipt", label:"Payment Receipt",      prefix:"REC",  icon:"✅", gstOnly:false},
  {id:"expense_voucher", label:"Expense Voucher",      prefix:"EXP",  icon:"💸", gstOnly:false},
];
const ALWAYS_NO_GST = new Set(["simple_bill","quotation","payment_receipt","expense_voucher","delivery_challan","purchase_order"]);
const GST_OPTIONAL  = new Set(["service_invoice","proforma","timesheet"]);

// ─── UTILS ────────────────────────────────────────────────────
const fmt   = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n||0);
const fmtN  = n => new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(n||0);
const today = () => new Date().toISOString().split("T")[0];
const uid   = () => Math.random().toString(36).slice(2,9).toUpperCase();
const SC    = g => (g||"").slice(0,2);
const validG= g => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g||"");
const _mem={};const LS={get:(k,d)=>{try{return _mem["bb4_"+k]!==undefined?_mem["bb4_"+k]:d;}catch{return d;}},set:(k,v)=>{try{_mem["bb4_"+k]=v;}catch{}}};
const daysAgo = d => new Date(Date.now()-d*86400000).toISOString().split("T")[0];
const addDays = (d,n) => new Date(new Date(d).getTime()+n*86400000).toISOString().split("T")[0];
const calcLines = (items, sg, bg, noGst) => {
  if(noGst) return items.map(i=>{const t=(+i.qty||0)*(+i.rate||0)*(1-(+i.disc||0)/100);return{...i,taxable:t,cgst:0,sgst:0,igst:0,taxAmt:0,lineTotal:t};});
  const ss=SC(sg),bs=SC(bg),same=ss&&bs&&ss===bs;
  return items.map(i=>{
    const t=(+i.qty||0)*(+i.rate||0)*(1-(+i.disc||0)/100),tx=t*(+i.gstRate||0)/100;
    return{...i,taxable:t,cgst:(same||!bg)?tx/2:0,sgst:(same||!bg)?tx/2:0,igst:(!same&&bg)?tx:0,taxAmt:tx,lineTotal:t+tx};
  });
};
const calcTotals = items => {
  const sub=items.reduce((a,i)=>a+(i.taxable||0),0),cg=items.reduce((a,i)=>a+(i.cgst||0),0),sg=items.reduce((a,i)=>a+(i.sgst||0),0),ig=items.reduce((a,i)=>a+(i.igst||0),0),tx=cg+sg+ig,gr=sub+tx,ro=Math.round(gr)-gr;
  return{subtotal:sub,totalCGST:cg,totalSGST:sg,totalIGST:ig,totalTax:tx,grand:gr,roundOff:ro,grandRounded:Math.round(gr)};
};
const numWords = n => {
  const a=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"],b=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const w=n=>{if(n<20)return a[n];if(n<100)return b[Math.floor(n/10)]+(n%10?"-"+a[n%10]:"");if(n<1000)return a[Math.floor(n/100)]+" Hundred"+(n%100?" and "+w(n%100):"");if(n<100000)return w(Math.floor(n/1000))+" Thousand"+(n%1000?" "+w(n%1000):"");if(n<10000000)return w(Math.floor(n/100000))+" Lakh"+(n%100000?" "+w(n%100000):"");return w(Math.floor(n/10000000))+" Crore"+(n%10000000?" "+w(n%10000000):"");};
  const int=Math.floor(Math.abs(n||0)),dec=Math.round(((Math.abs(n||0))-int)*100);
  return"Rupees "+w(int)+(dec?" and "+w(dec)+" Paise":"")+" Only";
};

// ─── SEED DATA ────────────────────────────────────────────────
const DEMO_BIZ = {name:"Demo Business",type:"shop",isGstRegistered:false,gstin:"",pan:"ABCDE1234F",phone:"9876543210",email:"demo@shop.com",address:{line1:"12 Market Road",city:"Pune",state:"Maharashtra",pin:"411001"},bank:{name:"SBI",account:"50200012345",ifsc:"SBIN0001234",upi:"demo@upi"},invoicePrefix:"BILL",invoiceCounter:1042,isComposition:false,logo:null,signature:null,accentId:"amber",layout:"modern",showHSN:true,showQR:true,showSign:true,showBankDetails:true,showDiscount:true,footerNote:"Thank you for your business! 🙏",termsNote:"Goods once sold will not be taken back."};
const DEMO_CUSTS = [
  {id:"C001",name:"Ramu General Store",gstin:"",phone:"9898989898",email:"",address:{city:"Pune",state:"Maharashtra"},type:"customer",openingBalance:0,notes:"Kirana store, weekly orders"},
  {id:"C002",name:"Priya Consulting",gstin:"",phone:"9977665544",email:"priya@freelance.com",address:{city:"Bangalore",state:"Karnataka"},type:"customer",openingBalance:0,notes:"Monthly retainer client"},
  {id:"C003",name:"Mohan Traders",gstin:"27AABCM9012C1Z1",phone:"9966554433",email:"mohan@traders.com",address:{city:"Pune",state:"Maharashtra"},type:"customer",openingBalance:5800,notes:"Bulk buyer"},
  {id:"C004",name:"Anita Clinic",gstin:"",phone:"9955443322",email:"",address:{city:"Nagpur",state:"Maharashtra"},type:"customer",openingBalance:0,notes:""},
  {id:"C005",name:"Suresh Hardware",gstin:"27AADCS1234A1Z5",phone:"9944332211",email:"suresh@hw.com",address:{city:"Pune",state:"Maharashtra"},type:"customer",openingBalance:0,notes:""},
];
const DEMO_ITEMS = [
  {id:"I001",name:"Basmati Rice 25kg",hsnCode:"1006",sacCode:"",type:"product",gstRate:5,unit:"bag",salePrice:1800,purchasePrice:1400,stock:150,lowStock:20},
  {id:"I002",name:"Cooking Oil 5L",hsnCode:"1515",sacCode:"",type:"product",gstRate:5,unit:"can",salePrice:650,purchasePrice:500,stock:80,lowStock:15},
  {id:"I003",name:"Wheat Flour 10kg",hsnCode:"1101",sacCode:"",type:"product",gstRate:0,unit:"bag",salePrice:340,purchasePrice:270,stock:200,lowStock:30},
  {id:"I004",name:"Web Design Service",hsnCode:"",sacCode:"9983",type:"service",gstRate:18,unit:"hrs",salePrice:2500,purchasePrice:0,stock:0,lowStock:0},
  {id:"I005",name:"Toor Dal 1kg",hsnCode:"0713",sacCode:"",type:"product",gstRate:0,unit:"kg",salePrice:120,purchasePrice:95,stock:300,lowStock:50},
  {id:"I006",name:"Consulting",hsnCode:"",sacCode:"9997",type:"service",gstRate:18,unit:"hrs",salePrice:3000,purchasePrice:0,stock:0,lowStock:0},
  {id:"I007",name:"Printer Paper A4 (Ream)",hsnCode:"4802",sacCode:"",type:"product",gstRate:12,unit:"box",salePrice:480,purchasePrice:360,stock:8,lowStock:10},
];
const DEMO_EXP = [
  {id:"E001",category:"Office Supplies",amount:2400,vendor:"Staples Store",date:daysAgo(2),paymentMode:"Cash",notes:"Stationery",receipt:null},
  {id:"E002",category:"Travel & Fuel",amount:800,vendor:"HP Petrol Pump",date:daysAgo(5),paymentMode:"UPI",notes:"Fuel for delivery",receipt:null},
  {id:"E003",category:"Utilities",amount:3200,vendor:"MSEDCL",date:daysAgo(10),paymentMode:"UPI",notes:"Electricity bill",receipt:null},
];
const seedInvoices = () => Array.from({length:12},(_,i)=>{
  const statuses = ["paid","unpaid","paid","overdue","paid","partial","draft","paid","overdue","unpaid","paid","paid"];
  const s = statuses[i];
  const grand = [5400,3600,12800,8200,2100,9600,4500,7200,15000,3800,6600,11200][i];
  return {
    id:`D${1042+i}`,invoiceNumber:`BILL-${1042+i}`,type:"simple_bill",hasGst:false,
    status:s, party:DEMO_CUSTS[i%5],
    items:[{id:"I001",name:"Basmati Rice 25kg",hsnCode:"1006",type:"product",gstRate:0,unit:"bag",qty:i+2,rate:1800,disc:i%3===0?5:0,taxable:(i+2)*1800*(1-(i%3===0?5:0)/100),cgst:0,sgst:0,igst:0,taxAmt:0,lineTotal:(i+2)*1800*(1-(i%3===0?5:0)/100)}],
    subtotal:grand,totalCGST:0,totalSGST:0,totalIGST:0,totalTax:0,
    grand,roundOff:0,grandRounded:grand,
    amountPaid:s==="paid"?grand:s==="partial"?Math.round(grand/2):0,
    paymentMode:"Cash",
    invoiceDate:daysAgo(i*5),dueDate:addDays(daysAgo(i*5),30),
    notes:"",poNumber:"",createdAt:new Date(Date.now()-i*5*86400000).toISOString(),
    recurring:null,
  };
});

// ─── GLOBAL CSS — PREMIUM SAAS + FULL MOBILE ──────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* ── Classic warm Indian business palette ── */
  --bg:     #F4F0E8;
  --bg2:    #FFFFFF;
  --bg3:    #EDE8DF;
  --bg4:    #E2DDD2;
  --border: rgba(120,100,70,0.18);
  --border2: rgba(120,100,70,0.09);
  --text:   #1C2430;
  --text2:  #374455;
  --muted:  #6E7D8F;
  --muted2: #A8B4BF;

  /* Accent — rich amber gold */
  --acc:        #D4870A;
  --acc2:       #A85E00;
  --acc-bg:     rgba(212,135,10,0.10);
  --acc-bg2:    rgba(212,135,10,0.06);
  --acc-border: rgba(212,135,10,0.30);

  --red:   #D93025;
  --green: #1F8A4C;
  --blue:  #1A6BC4;
  --purple:#6B48C8;

  --radius-sm: 6px;
  --radius:    10px;
  --radius-lg: 14px;
  --radius-xl: 18px;

  --shadow-sm: 0 1px 4px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05);
  --shadow:    0 4px 14px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.06);
  --shadow-lg: 0 16px 44px rgba(0,0,0,.14), 0 4px 16px rgba(0,0,0,.08);
  --shadow-acc: 0 4px 18px rgba(212,135,10,.28);

  --sidebar-w: 212px;
  --header-h:  56px;

  /* sidebar navy */
  --sidebar-bg: #1A2F5E;
  --sidebar-text: rgba(255,255,255,0.75);
  --sidebar-active: rgba(255,255,255,0.12);
  --sidebar-hover: rgba(255,255,255,0.07);
}

/* ── DARK MODE (toggle) ── */
body.dark-mode {
  --bg:     #0D1117;
  --bg2:    #161B22;
  --bg3:    #1C2333;
  --bg4:    #21262D;
  --border: rgba(139,148,158,0.15);
  --border2: rgba(139,148,158,0.08);
  --text:   #E6EDF3;
  --text2:  #C9D1D9;
  --muted:  #8B949E;
  --muted2: #484F58;
  --shadow-sm: 0 1px 3px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2);
  --shadow:    0 4px 12px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.2);
  --shadow-lg: 0 16px 40px rgba(0,0,0,.5), 0 4px 16px rgba(0,0,0,.3);
  --sidebar-bg: rgba(22,27,34,.97);
  --sidebar-text: rgba(139,148,158,1);
  --sidebar-active: rgba(212,135,10,0.12);
  --sidebar-hover: rgba(255,255,255,0.04);
}
body.dark-mode .inp { background: var(--bg3); color: var(--text); }
body.dark-mode .inp:focus { background: var(--bg4); }
body.dark-mode select.inp option { background: var(--bg3); color: var(--text); }
body.dark-mode .modal { background: var(--bg2); }
body.dark-mode .mob-header { background: rgba(13,17,23,.96) !important; border-color: var(--border2) !important; }

html { font-size: 14px; -webkit-text-size-adjust: 100%; }
body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; font-size: 13.5px; line-height: 1.55; -webkit-font-smoothing: antialiased; overflow-x: hidden; transition: background .3s, color .3s; }

::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--muted2); }

.out  { font-family: 'Outfit', sans-serif; }
.mono { font-family: 'JetBrains Mono', monospace; letter-spacing: -0.01em; }
.num  { font-family: 'JetBrains Mono', monospace; text-align: right; }

.card { background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius); transition: border-color .2s, box-shadow .2s; box-shadow: var(--shadow-sm); }
.card:hover { box-shadow: var(--shadow); }
.card:focus-within { border-color: var(--border); }

.btn { cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all .18s cubic-bezier(.4,0,.2,1); white-space: nowrap; border-radius: var(--radius-sm); line-height: 1; position: relative; overflow: hidden; }
.btn::after { content: ''; position: absolute; inset: 0; background: transparent; border-radius: inherit; transition: background .15s; }
.btn:hover::after { background: rgba(0,0,0,.05); }
.btn:active::after { background: rgba(0,0,0,.10); }
.btn-p { background: linear-gradient(135deg, var(--acc) 0%, var(--acc2) 100%); color: #fff; padding: 9px 18px; font-size: 13px; box-shadow: var(--shadow-sm); }
.btn-p:hover { transform: translateY(-1px); box-shadow: var(--shadow-acc); filter: brightness(1.06); }
.btn-p:active { transform: translateY(0); box-shadow: var(--shadow-sm); }
.btn-ghost { background: var(--bg3); color: var(--muted); border: 1px solid var(--border2); padding: 8px 14px; font-size: 13px; }
.btn-ghost:hover { background: var(--bg4); color: var(--text2); border-color: var(--border); }
.btn-g { background: rgba(31,138,76,.10); color: var(--green); border: 1px solid rgba(31,138,76,.22); padding: 8px 15px; font-size: 13px; }
.btn-g:hover { background: rgba(31,138,76,.18); }
.btn-danger { background: rgba(217,48,37,.08); color: var(--red); border: 1px solid rgba(217,48,37,.20); padding: 6px 11px; font-size: 12px; }
.btn-danger:hover { background: rgba(217,48,37,.16); }
.btn-sm  { padding: 5px 11px; font-size: 12px; border-radius: 5px; }
.btn-xs  { padding: 3px 8px; font-size: 11px; border-radius: 5px; }
.btn:disabled { opacity: .45; cursor: not-allowed; transform: none !important; box-shadow: none !important; }

.inp { background: var(--bg2); border: 1.5px solid var(--border); border-radius: var(--radius-sm); color: var(--text); padding: 9px 13px; font-size: 13px; font-family: 'DM Sans', sans-serif; width: 100%; outline: none; transition: border-color .18s, box-shadow .18s; -webkit-appearance: none; }
.inp:hover { border-color: var(--muted2); }
.inp:focus { border-color: var(--acc); box-shadow: 0 0 0 3px var(--acc-bg); }
.inp::placeholder { color: var(--muted2); }
.inp-sm { padding: 6px 10px; font-size: 12px; }
select.inp option { background: var(--bg2); color: var(--text); }
textarea.inp { resize: vertical; min-height: 72px; }

.lbl { font-size: 10.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: block; }
.tag { display: inline-flex; align-items: center; border-radius: 4px; font-size: 10.5px; font-weight: 700; padding: 3px 9px; letter-spacing: .02em; }
.tag-p  { background: rgba(31,138,76,.10);   color: var(--green); border: 1px solid rgba(31,138,76,.22); }
.tag-u  { background: rgba(212,135,10,.10);  color: var(--acc2);  border: 1px solid rgba(212,135,10,.22); }
.tag-o  { background: rgba(217,48,37,.10);   color: var(--red);   border: 1px solid rgba(217,48,37,.22); }
.tag-d  { background: rgba(110,125,143,.09); color: var(--muted); border: 1px solid rgba(110,125,143,.20); }
.tag-pt { background: rgba(26,107,196,.10);  color: var(--blue);  border: 1px solid rgba(26,107,196,.22); }

.divider { height: 1px; background: var(--border2); margin: 12px 0; }

.tip-wrap { position: relative; display: inline-flex; }
.tip-wrap:hover .tip-box { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.tip-box { position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%) translateY(4px); background: var(--text); border-radius: 6px; padding: 5px 10px; font-size: 11px; white-space: nowrap; z-index: 300; pointer-events: none; opacity: 0; visibility: hidden; transition: all .16s; box-shadow: var(--shadow); color: var(--bg2); }

@keyframes fi    { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
@keyframes spin  { to   { transform:rotate(360deg); } }
@keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.45;} }
@keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
.fi       { animation: fi .22s ease both; }
.spin     { animation: spin .75s linear infinite; }
.pulse    { animation: pulse 2.2s ease infinite; }
.slide-up { animation: slideUp .28s cubic-bezier(.4,0,.2,1) both; }

/* ── SIDEBAR (navy classic) ── */
.ni { cursor: pointer; border: none; background: none; font-family: 'DM Sans', sans-serif; border-radius: var(--radius-sm); padding: 8px 10px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 9px; width: 100%; color: var(--sidebar-text); transition: all .16s; }
.ni:hover { background: var(--sidebar-hover); color: rgba(255,255,255,.95); }
.ni.active { background: var(--sidebar-active); color: #fff; font-weight: 700; }
.ni.active .ni-dot { background: var(--acc); }
.ni-dot { width: 3px; height: 16px; border-radius: 2px; background: transparent; flex-shrink: 0; }

.app-wrap { display: flex; min-height: 100vh; }
.sidebar { width: var(--sidebar-w); background: var(--sidebar-bg); border-right: none; box-shadow: 2px 0 16px rgba(0,0,0,.12); display: flex; flex-direction: column; padding: 14px 8px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 50; transition: transform .3s cubic-bezier(.4,0,.2,1); overflow-y: auto; }
.main-content { margin-left: var(--sidebar-w); flex: 1; overflow-y: auto; min-height: 100vh; max-height: 100vh; padding: 24px 28px; }

.mob-header { display: none; position: fixed; top: 0; left: 0; right: 0; height: var(--header-h); background: var(--sidebar-bg); border-bottom: none; box-shadow: 0 2px 12px rgba(0,0,0,.15); z-index: 60; align-items: center; padding: 0 16px; gap: 12px; }
.mob-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.55); z-index: 49; }
.mob-overlay.visible { display: block; }
.hamburger { background: none; border: none; cursor: pointer; color: rgba(255,255,255,.7); padding: 6px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px; transition: color .15s; }
.hamburger:hover { color: #fff; }
.hamburger span { display: block; width: 18px; height: 2px; background: currentColor; border-radius: 1px; transition: all .25s; }
.hamburger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
.hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
.hamburger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

.overlay { position: fixed; inset: 0; background: rgba(20,30,50,.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px; }
.modal { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; width: 100%; max-width: 740px; max-height: 92vh; overflow-y: auto; box-shadow: var(--shadow-lg); animation: slideUp .25s cubic-bezier(.4,0,.2,1) both; }
.modal-lg { max-width: 980px; }

.tbl-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: var(--radius); }
.tbl-wrap .card { border-radius: 0; border: none; box-shadow: none; }
.trow { border-bottom: 1px solid var(--border2); transition: background .12s; }
.trow:hover { background: var(--bg3); }
.trow:last-child { border-bottom: none; }
.thead-cell { font-size: 10px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .07em; padding-bottom: 8px; }

.kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
.qa-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; }
.chart-grid { display: grid; grid-template-columns: 3fr 1.3fr; gap: 12px; margin-bottom: 12px; }
.bottom-grid { display: grid; grid-template-columns: 2.2fr 1fr 1.2fr; gap: 12px; }
.cust-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

@media print {
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body * { visibility: hidden !important; }
  .print-wrap, .print-wrap * { visibility: visible !important; }
  .print-wrap { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; background: #fff !important; }
}
.print-only { display: none; }

@media (max-width: 1024px) {
  :root { --sidebar-w: 56px; }
  .sidebar { padding: 12px 6px; overflow: visible; }
  .sidebar-logo-text, .ni-label, .ni-dot, .sidebar-biz, .sidebar-mode-pill, .sidebar-new-btn-text { display: none; }
  .ni { padding: 9px; justify-content: center; border-radius: 10px; }
  .ni .ni-icon { font-size: 18px; }
  .sidebar-new-btn { padding: 9px; justify-content: center; min-width: 0; }
  .main-content { padding: 18px 16px; }
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
  .qa-grid  { grid-template-columns: repeat(4, 1fr); }
}

@media (max-width: 768px) {
  :root { --sidebar-w: 0px; }
  .mob-header { display: flex; }
  .sidebar { width: 250px; transform: translateX(-100%); top: 0; z-index: 80; box-shadow: 4px 0 24px rgba(0,0,0,.25); padding: 14px 8px; }
  .sidebar.mob-open { transform: translateX(0); }
  .sidebar.mob-open .sidebar-logo-text, .sidebar.mob-open .ni-label, .sidebar.mob-open .ni-dot, .sidebar.mob-open .sidebar-biz, .sidebar.mob-open .sidebar-mode-pill, .sidebar.mob-open .sidebar-new-btn-text { display: initial; }
  .sidebar.mob-open .ni { padding: 8px 10px; justify-content: flex-start; }
  .sidebar.mob-open .ni .ni-icon { font-size: 16px; }
  .sidebar.mob-open .sidebar-new-btn { padding: 9px 14px; justify-content: center; }
  .main-content { margin-left: 0; padding: 14px 14px; padding-top: calc(var(--header-h) + 14px); min-height: calc(100vh - var(--header-h)); }
  .kpi-grid   { grid-template-columns: 1fr 1fr; gap: 8px; }
  .qa-grid    { grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .chart-grid { grid-template-columns: 1fr; }
  .bottom-grid { grid-template-columns: 1fr; }
  .form-2col  { grid-template-columns: 1fr; }
  .overlay { padding: 0; align-items: flex-end; }
  .modal { max-width: 100%; max-height: 96vh; border-radius: var(--radius-lg) var(--radius-lg) 0 0; padding: 18px 16px; }
  .page-title { font-size: 1.2rem !important; }
  .kpi-val { font-size: 1.15rem !important; }
  .tbl-wrap { border-radius: var(--radius); border: 1px solid var(--border2); }
}

@media (max-width: 420px) {
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .qa-grid  { grid-template-columns: repeat(4, 1fr); }
  .main-content { padding: 12px 10px; padding-top: calc(var(--header-h) + 12px); }
}
`;

// ─── ATOMS ────────────────────────────────────────────────────
const SBadge = ({s}) => {
  const m = {paid:"tag-p",unpaid:"tag-u",overdue:"tag-o",draft:"tag-d",partial:"tag-pt"};
  const l = {paid:"✓ Paid",unpaid:"Unpaid",overdue:"Overdue",draft:"Draft",partial:"Partial"};
  return <span className={`tag ${m[s]||"tag-d"}`}>{l[s]||s}</span>;
};
const Spinner = ({size=14}) => <div className="spin" style={{width:size,height:size,border:`2px solid rgba(255,255,255,.1)`,borderTopColor:"var(--acc)",borderRadius:"50%",flexShrink:0}}/>;
const Tip = ({children,tip}) => <div className="tip-wrap">{children}<div className="tip-box">{tip}</div></div>;
const Toast = ({msg,type}) => <div style={{position:"fixed",top:16,right:16,zIndex:9999,padding:"11px 18px",background:type==="err"?"rgba(248,81,73,.96)":type==="warn"?"rgba(240,180,41,.96)":"rgba(63,185,80,.96)",borderRadius:10,fontSize:13,fontWeight:600,color:type==="warn"?"#000":"#fff",boxShadow:"0 8px 28px rgba(0,0,0,.4)",animation:"fi .2s ease",display:"flex",alignItems:"center",gap:8,maxWidth:"90vw"}}>{type==="err"?"✗":type==="warn"?"⚠":"✓"} {msg}</div>;
const KPI = ({label,val,sub,color,icon,delay=0,onClick,trend}) => (
  <div className="card fi" style={{padding:"16px 18px",animationDelay:`${delay}ms`,cursor:onClick?"pointer":"default",borderLeft:`2.5px solid ${color}`}} onClick={onClick}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}><div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",flex:1,lineHeight:1.3}}>{label}</div><span style={{fontSize:16,flexShrink:0}}>{icon}</span></div>
    <div className="out kpi-val" style={{fontSize:"1.4rem",fontWeight:800,color,lineHeight:1.05,marginBottom:4}}>{val}</div>
    {sub&&<div style={{fontSize:11,color:"var(--muted)",display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>{sub}{trend!=null&&<span style={{color:trend>0?"var(--green)":"var(--red)",fontSize:10,fontWeight:700}}>{trend>0?"↑":"↓"}{Math.abs(trend)}%</span>}</div>}
  </div>
);
const Empty = ({icon,title,sub,cta,onCta}) => (
  <div style={{textAlign:"center",padding:"44px 20px"}}><div style={{fontSize:40,marginBottom:10}}>{icon}</div><div className="out" style={{fontSize:15,fontWeight:800,marginBottom:6,color:"var(--text)"}}>{title}</div><div style={{fontSize:12,color:"var(--muted)",marginBottom:16}}>{sub}</div>{cta&&<button className="btn btn-p" onClick={onCta}>{cta}</button>}</div>
);

// ─── INVOICE PRINT ────────────────────────────────────────────
const InvoicePrint = ({inv, biz}) => {
  if(!inv||!biz) return null;
  const accentObj = ACCENTS.find(a=>a.id===(biz.accentId||"amber"))||ACCENTS[0];
  const ac=accentObj.hex,acdark=accentObj.dark,aclight=accentObj.light;
  const isGst=inv.hasGst&&biz.isGstRegistered,docLabel=DOC_TYPES.find(d=>d.id===inv.type)?.label||"Invoice";
  const showHSN=isGst&&biz.showHSN!==false,showDisc=biz.showDiscount!==false&&inv.items?.some(i=>+i.disc>0);
  const showQR=biz.showQR!==false&&biz.bank?.upi,showSign=biz.showSign!==false,showBank=biz.showBankDetails!==false;
  const hasTax=isGst&&inv.totalTax>0,layout=biz.layout||"modern";
  const font="'Segoe UI',Arial,Helvetica,sans-serif";
  const s={
    wrap:{fontFamily:font,fontSize:"10.5pt",color:"#1a1a2a",background:"#fff",padding:"9mm",width:"100%",minHeight:"277mm",position:"relative"},
    h1hdr:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"5mm",paddingBottom:"4mm",borderBottom:`2.5px solid ${ac}`},
    bizName:{fontSize:layout==="bold"?"20pt":"17pt",fontWeight:900,color:layout==="minimal"?"#1a1a2a":ac,marginBottom:3},
    bizSub:{fontSize:"8.5pt",color:"#666",lineHeight:1.7},
    docBadge:{background:layout==="bold"?ac:"#f8f9ff",color:layout==="bold"?"#000":acdark,padding:"6px 16px",borderRadius:7,fontWeight:900,fontSize:layout==="bold"?"13pt":"11pt",textTransform:"uppercase",letterSpacing:".05em",border:layout==="bold"?`2px solid ${ac}`:`2px solid ${aclight}`},
    secBox:{padding:"4mm 5mm",borderRadius:6,border:`1px solid #e5e7eb`},
    thhdr:{background:ac,color:"#000",fontSize:"8.5pt",fontWeight:700,textTransform:"uppercase",letterSpacing:".04em"},
    thcell:{padding:"4mm 3.5mm",textAlign:"left"},
    tdbody:{fontSize:"9.5pt",borderBottom:"1px solid #f0f0f0"},
    tdcell:{padding:"3.5mm 3.5mm",verticalAlign:"top"},
    totRow:{display:"flex",justifyContent:"space-between",padding:"3px 0",fontSize:"9.5pt"},
    totRowBold:{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:"11pt",fontWeight:900,color:ac,borderTop:`2px solid ${ac}`,marginTop:4,paddingTop:6},
  };
  return(
    <div className="print-wrap" style={s.wrap}>
      <div style={s.h1hdr}>
        <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
          {biz.logo&&<img src={biz.logo} alt="logo" style={{height:44,objectFit:"contain",marginRight:4}}/>}
          <div>
            <div style={s.bizName}>{biz.name}</div>
            <div style={s.bizSub}>
              {[biz.address?.line1,biz.address?.city,biz.address?.state,biz.address?.pin].filter(Boolean).join(", ")}
              {biz.phone&&<><br/>Ph: {biz.phone}{biz.email&&" | "+biz.email}</>}
              {isGst&&biz.gstin&&<><br/>GSTIN: <strong>{biz.gstin}</strong>{biz.pan&&" | PAN: "+biz.pan}</>}
              {!biz.isGstRegistered&&<><br/><span style={{color:"#999",fontStyle:"italic",fontSize:"7pt"}}>Not GST Registered</span></>}
            </div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={s.docBadge}>{docLabel}</div>
          <div style={{marginTop:6,fontSize:"8pt",color:"#555",lineHeight:1.7}}>
            <div><strong>No:</strong> {inv.invoiceNumber}</div>
            <div><strong>Date:</strong> {inv.invoiceDate}</div>
            {inv.dueDate&&<div><strong>Due:</strong> {inv.dueDate}</div>}
            {inv.poNumber&&<div><strong>PO:</strong> {inv.poNumber}</div>}
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4mm",marginBottom:"5mm"}}>
        <div style={{...s.secBox,borderLeft:`3px solid ${ac}`}}>
          <div style={{fontSize:"8pt",fontWeight:700,textTransform:"uppercase",color:"#888",letterSpacing:".1em",marginBottom:5}}>Bill To</div>
          <div style={{fontWeight:800,fontSize:"12pt"}}>{inv.party?.name||"Customer"}</div>
          <div style={{fontSize:"9pt",color:"#555",lineHeight:1.7,marginTop:2}}>
            {inv.party?.address?.city&&`${inv.party.address.city}, ${inv.party.address.state}`}
            {inv.party?.phone&&<><br/>Ph: {inv.party.phone}</>}
            {isGst&&inv.party?.gstin&&<><br/>GSTIN: {inv.party.gstin}</>}
          </div>
        </div>
        <div style={{...s.secBox,background:aclight,borderColor:ac,textAlign:"right"}}>
          {hasTax&&<div style={{fontSize:"8.5pt",color:"#666",marginBottom:2}}>Subtotal: ₹{fmtN(inv.subtotal)}</div>}
          {hasTax&&inv.totalCGST>0&&<><div style={{fontSize:"8.5pt",color:"#666"}}>CGST: ₹{fmtN(inv.totalCGST)}</div><div style={{fontSize:"8.5pt",color:"#666",marginBottom:2}}>SGST: ₹{fmtN(inv.totalSGST)}</div></>}
          {hasTax&&inv.totalIGST>0&&<div style={{fontSize:"8.5pt",color:"#666",marginBottom:2}}>IGST: ₹{fmtN(inv.totalIGST)}</div>}
          <div style={{fontSize:"8pt",fontWeight:700,textTransform:"uppercase",color:"#888",letterSpacing:".1em",marginBottom:4}}>Total Amount</div>
          <div style={{fontSize:"24pt",fontWeight:900,color:ac,lineHeight:1}}>₹{fmtN(inv.grandRounded)}</div>
          <div style={{fontSize:"8pt",color:"#777",marginTop:5,fontStyle:"italic"}}>{numWords(inv.grandRounded)}</div>
          {showQR&&<div style={{marginTop:6,display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6}}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=56x56&data=upi://pay?pa=${biz.bank.upi}&am=${inv.grandRounded}&tn=${inv.invoiceNumber}&cu=INR`} alt="UPI QR" style={{width:56,height:56,border:`1px solid ${ac}`,borderRadius:4}}/>
            <div style={{fontSize:"6.5pt",color:"#777",textAlign:"left"}}>Scan to Pay<br/>UPI: {biz.bank.upi}</div>
          </div>}
        </div>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",marginBottom:"4mm",fontSize:"8.5pt"}}>
        <thead>
          <tr style={s.thhdr}>
            <th style={{...s.thcell,width:20}}>#</th>
            <th style={s.thcell}>Description</th>
            {showHSN&&<th style={{...s.thcell,textAlign:"center",width:50}}>HSN/SAC</th>}
            <th style={{...s.thcell,textAlign:"center",width:35}}>Qty</th>
            <th style={{...s.thcell,textAlign:"center",width:30}}>Unit</th>
            <th style={{...s.thcell,textAlign:"right",width:55}}>Rate (₹)</th>
            {showDisc&&<th style={{...s.thcell,textAlign:"center",width:35}}>Disc%</th>}
            {isGst&&<th style={{...s.thcell,textAlign:"center",width:35}}>GST%</th>}
            {isGst&&<th style={{...s.thcell,textAlign:"right",width:45}}>Tax (₹)</th>}
            <th style={{...s.thcell,textAlign:"right",width:60}}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {(inv.items||[]).map((item,i)=>(
            <tr key={i} style={{...s.tdbody,background:i%2===0?"#fff":"#fafafa"}}>
              <td style={{...s.tdcell,textAlign:"center",color:"#888"}}>{i+1}</td>
              <td style={{...s.tdcell,fontWeight:600}}>{item.name}</td>
              {showHSN&&<td style={{...s.tdcell,textAlign:"center",color:"#666"}}>{item.hsnCode||item.sacCode||"—"}</td>}
              <td style={{...s.tdcell,textAlign:"center"}}>{item.qty}</td>
              <td style={{...s.tdcell,textAlign:"center",color:"#666"}}>{item.unit||"pcs"}</td>
              <td style={{...s.tdcell,textAlign:"right"}}>{fmtN(item.rate)}</td>
              {showDisc&&<td style={{...s.tdcell,textAlign:"center",color:+item.disc>0?"#059669":"#999"}}>{+item.disc>0?item.disc+"% ↓":"—"}</td>}
              {isGst&&<td style={{...s.tdcell,textAlign:"center"}}>{item.gstRate||0}%</td>}
              {isGst&&<td style={{...s.tdcell,textAlign:"right",color:acdark}}>{fmtN(item.taxAmt)}</td>}
              <td style={{...s.tdcell,textAlign:"right",fontWeight:700}}>{fmtN(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{display:"flex",justifyContent:"space-between",gap:"8mm",marginBottom:"4mm"}}>
        <div style={{flex:1}}>
          {showBank&&biz.bank?.account&&(
            <div style={{...s.secBox,marginBottom:"3mm"}}>
              <div style={{fontSize:"7pt",fontWeight:700,textTransform:"uppercase",color:"#888",letterSpacing:".1em",marginBottom:4}}>Bank Details</div>
              <div style={{fontSize:"8pt",color:"#444",lineHeight:1.8}}><strong>{biz.bank.name}</strong><br/>A/C No: {biz.bank.account}<br/>IFSC: {biz.bank.ifsc}{biz.bank.upi&&<><br/>UPI: {biz.bank.upi}</>}</div>
            </div>
          )}
          {biz.termsNote&&<div style={{fontSize:"7pt",color:"#666",marginTop:3}}><strong>Terms:</strong> {biz.termsNote}</div>}
          {inv.notes&&<div style={{fontSize:"7.5pt",color:"#444",marginTop:4,padding:"2mm 3mm",background:"#fffbf0",borderLeft:`2px solid ${ac}`,borderRadius:"0 4px 4px 0"}}><strong>Note:</strong> {inv.notes}</div>}
        </div>
        <div style={{minWidth:"55mm"}}>
          <div style={{...s.secBox,padding:"4mm"}}>
            {hasTax&&inv.subtotal!==inv.grandRounded&&<div style={s.totRow}><span>Subtotal</span><span>₹{fmtN(inv.subtotal)}</span></div>}
            {hasTax&&inv.totalCGST>0&&<><div style={s.totRow}><span>CGST</span><span style={{color:acdark}}>₹{fmtN(inv.totalCGST)}</span></div><div style={s.totRow}><span>SGST</span><span style={{color:acdark}}>₹{fmtN(inv.totalSGST)}</span></div></>}
            {hasTax&&inv.totalIGST>0&&<div style={s.totRow}><span>IGST</span><span style={{color:acdark}}>₹{fmtN(inv.totalIGST)}</span></div>}
            {Math.abs(inv.roundOff||0)>0.005&&<div style={s.totRow}><span>Round Off</span><span>{(inv.roundOff||0)>0?"+":""}{(inv.roundOff||0).toFixed(2)}</span></div>}
            <div style={s.totRowBold}><span>TOTAL</span><span>₹{fmtN(inv.grandRounded)}</span></div>
            {inv.amountPaid>0&&inv.status!=="paid"&&<div style={{...s.totRow,color:"#059669",marginTop:4}}><span>Paid</span><span>₹{fmtN(inv.amountPaid)}</span></div>}
            {inv.amountPaid>0&&inv.status!=="paid"&&<div style={{...s.totRow,color:"#DC2626",fontWeight:700}}><span>Balance Due</span><span>₹{fmtN(inv.grandRounded-(inv.amountPaid||0))}</span></div>}
          </div>
          {showSign&&<div style={{marginTop:"4mm",textAlign:"right"}}>
            {biz.signature&&<img src={biz.signature} alt="sig" style={{height:32,marginBottom:3,display:"inline-block"}}/>}
            <div style={{borderTop:`1px solid #333`,paddingTop:3,fontSize:"7.5pt",color:"#444",display:"inline-block",minWidth:100,textAlign:"center"}}>For {biz.name}<br/>Authorised Signatory</div>
          </div>}
        </div>
      </div>
      {biz.footerNote&&<div style={{textAlign:"center",fontSize:"7.5pt",color:"#777",borderTop:"1px solid #e5e7eb",paddingTop:"3mm",marginTop:"2mm"}}>{biz.footerNote}</div>}
    </div>
  );
};

// ─── INVOICE MODAL ────────────────────────────────────────────
const InvoiceModal = ({inv, customers=[], items=[], business, onUpdateBiz, onSave, onClose, previewModeOnly=false}) => {
  const isReg = !!business?.isGstRegistered;
  const defType = isReg ? "tax_invoice" : "simple_bill";
  const [form, setF] = useState(inv||{type:defType,party:null,notes:"",invoiceDate:today(),dueDate:addDays(today(),30),hasGst:isReg,poNumber:"",shipTo:"",recurring:null});
  const [lines, setLines] = useState(inv?.items||[{id:uid(),name:"",hsnCode:"",sacCode:"",type:"product",gstRate:isReg?18:0,unit:"pcs",qty:1,rate:0,disc:0}]);
  const [tab, setTab] = useState("details");
  const [pSearch, setPSearch] = useState(inv?.party?.name||"");
  const [showP, setShowP] = useState(false);
  const [showItem, setShowItem] = useState(null);
  const [iQuery, setIQ] = useState("");
  const [preview, setPreview] = useState(previewModeOnly);
  const sf = f => setF(p=>({...p,...f}));
  const avDocs = DOC_TYPES.filter(d=>isReg?true:!d.gstOnly);
  const useGST = form.hasGst&&isReg&&!ALWAYS_NO_GST.has(form.type);
  const docType = DOC_TYPES.find(d=>d.id===form.type)||DOC_TYPES[0];
  const invNum = inv?.invoiceNumber||(docType.prefix+"-"+(business?.invoiceCounter||1001));
  const fParties = customers.filter(c=>c.name.toLowerCase().includes(pSearch.toLowerCase())||c.phone?.includes(pSearch)).slice(0,7);
  const fItems = q => items.filter(i=>i.name.toLowerCase().includes((q||"").toLowerCase())).slice(0,8);
  
  const calcedLines = useMemo(()=>calcLines(
    lines.map(i=>({...i,qty:+i.qty||0,rate:+i.rate||0,disc:+i.disc||0,gstRate:+i.gstRate||0})),
    business?.gstin,form.party?.gstin,!useGST
  ),[lines,form.party,business,useGST]);
  
  const totals = useMemo(()=>calcTotals(calcedLines),[calcedLines]);
  const taxMode = ()=>{const ss=SC(business?.gstin),bs=SC(form.party?.gstin);if(!form.party?.gstin)return"CGST+SGST";if(ss===bs)return`CGST+SGST (${SC_MAP[ss]||ss})`;return`IGST (Inter-state)`;};
  const addLine = ()=>setLines(p=>[...p,{id:uid(),name:"",hsnCode:"",sacCode:"",type:"product",gstRate:isReg?18:0,unit:"pcs",qty:1,rate:0,disc:0}]);
  const remLine = id=>setLines(p=>p.filter(i=>i.id!==id));
  const updL = (id,f,v)=>setLines(p=>p.map(i=>i.id===id?{...i,[f]:v}:i));
  const pickItem = (lid,item)=>{setLines(p=>p.map(i=>i.id===lid?{...i,name:item.name,hsnCode:item.hsnCode||"",sacCode:item.sacCode||"",type:item.type,gstRate:item.gstRate||0,unit:item.unit||"pcs",rate:item.salePrice||0}:i));setShowItem(null);setIQ("");};
  const doSave = status=>onSave?.({...form,id:inv?.id||uid(),invoiceNumber:invNum,status,items:calcedLines,...totals,hasGst:useGST,amountPaid:inv?.amountPaid||0,createdAt:inv?.createdAt||new Date().toISOString()});
  const waMsg = ()=>`Hi${form.party?.name?" "+form.party.name:""}! 🙏\n\n${docType.label}: *${invNum}*\nAmount: *${fmt(totals.grandRounded)}*\n${form.dueDate?"Due: "+form.dueDate+"\n":""}\nFrom: *${business?.name}*\n${business?.bank?.upi?"Pay via UPI: "+business.bank.upi:""}`;
  const wa = ()=>window.open(`https://wa.me/?text=${encodeURIComponent(waMsg())}`,"_blank");

  if(preview) {
    const isMobile = window.innerWidth <= 768;
    const scaleFactor = isMobile ? (window.innerWidth - 32) / 720 : 1; 
    return(
      <div className="overlay" onClick={onClose} style={{padding:0, alignItems:"flex-start"}}>
        <div style={{background:"var(--bg)",width:"100%",height:"100vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
          
          <div className="no-print" style={{background:"var(--bg2)",padding:"12px 16px",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            {!previewModeOnly && <button className="btn btn-ghost btn-sm" onClick={()=>setPreview(false)}>← Edit</button>}
            <button className="btn btn-p btn-sm" onClick={()=>window.print()}>🖨 Print / PDF</button>
            <button className="btn btn-g btn-sm" onClick={wa}>💬 WhatsApp</button>
            <button className="btn btn-ghost btn-sm" style={{marginLeft:"auto"}} onClick={onClose}>✕</button>
          </div>

          <div className="no-print" style={{background:"var(--bg3)",padding:"10px 16px",display:"flex",gap:12,alignItems:"center",justifyContent:"center",flexWrap:"wrap",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,color:"var(--muted)",fontWeight:700}}>TEMPLATE:</span>
              <select className="inp inp-sm" style={{width:100,padding:"4px 8px"}} value={business.layout||"modern"} onChange={e=>onUpdateBiz?.({...business,layout:e.target.value})}>
                 <option value="modern">Modern</option>
                 <option value="classic">Classic</option>
                 <option value="minimal">Minimal</option>
                 <option value="bold">Bold</option>
              </select>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:10,color:"var(--muted)",fontWeight:700}}>THEME:</span>
              <div style={{display:"flex",gap:6}}>
                {ACCENTS.map(a=>(
                  <div key={a.id} onClick={()=>onUpdateBiz?.({...business,accentId:a.id})} style={{width:20,height:20,borderRadius:"50%",background:a.hex,cursor:"pointer",border:`2px solid ${business.accentId===a.id?"#fff":"transparent"}`,boxShadow:business.accentId===a.id?`0 0 10px ${a.hex}`:"none",transition:"all .2s"}}/>
                ))}
              </div>
            </div>
          </div>
          
          <div style={{flex:1,overflow:"auto",padding:"16px",display:"flex",justifyContent:"center",background:"#525659"}}>
            <div style={{
               width: "190mm", minHeight: "277mm", background: "#fff", boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
               transformOrigin: "top center", transform: `scale(${scaleFactor})`,
               marginBottom: isMobile ? `-${(1 - scaleFactor) * 100}%` : "0"
            }}>
              <InvoicePrint inv={{...form,invoiceNumber:invNum,items:calcedLines,...totals,hasGst:useGST}} biz={business}/>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-lg fi" style={{padding:0, display:"flex", flexDirection:"column", overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:"20px 24px", overflowY:"auto"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:12}}>
            <div style={{minWidth:0}}>
              <div className="out" style={{fontSize:17,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{inv?"Edit":"New"} {docType.label}</div>
              <div className="mono" style={{fontSize:11,color:"var(--acc)",marginTop:1}}>{invNum}</div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setPreview(true)}>👁 Preview</button>
              <button className="btn btn-ghost btn-sm" style={{color:"#25D366"}} onClick={wa}>💬</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
            </div>
          </div>

          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:13,paddingBottom:12,borderBottom:"1px solid var(--border2)"}}>
            {avDocs.map(d=>(
              <button key={d.id} className="btn btn-sm" onClick={()=>sf({type:d.id,hasGst:isReg&&!ALWAYS_NO_GST.has(d.id)})} style={{fontSize:11,background:form.type===d.id?"var(--acc-bg)":"rgba(255,255,255,.04)",color:form.type===d.id?"var(--acc)":"var(--muted)",border:`1px solid ${form.type===d.id?"var(--acc-border)":"var(--border2)"}`}}>{d.icon} {d.label}</button>
            ))}
          </div>

          {isReg&&GST_OPTIONAL.has(form.type)&&<div style={{marginBottom:11,display:"flex",gap:8,alignItems:"center",padding:"9px 13px",background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.18)",borderRadius:9,fontSize:12,flexWrap:"wrap"}}>
            <input type="checkbox" id="gchk" style={{accentColor:"var(--acc)",width:14,height:14}} checked={form.hasGst} onChange={e=>sf({hasGst:e.target.checked})}/>
            <label htmlFor="gchk" style={{cursor:"pointer",flex:1}}>Include GST on this document</label>
            {useGST&&form.party&&<span style={{fontSize:11,background:"var(--acc-bg)",color:"var(--acc)",padding:"2px 9px",borderRadius:5,border:"1px solid var(--acc-border)"}}>{taxMode()}</span>}
          </div>}

          {/* Tabs */}
          <div style={{display:"flex",gap:4,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
            {[["details","📝 Info"],["items","📦 Items"],["more","📋 More"]].map(([id,l])=>(
              <button key={id} className="btn btn-sm" onClick={()=>setTab(id)} style={{fontSize:12,background:tab===id?"var(--acc-bg)":"transparent",color:tab===id?"var(--acc)":"var(--muted)",border:`1px solid ${tab===id?"var(--acc-border)":"transparent"}`}}>{l}</button>
            ))}
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,background:"var(--acc-bg)",border:"1px solid var(--acc-border)",borderRadius:9,padding:"4px 12px"}}>
              <span style={{fontSize:11,color:"var(--muted)"}}>Total:</span>
              <span className="out" style={{fontSize:18,fontWeight:900,color:"var(--acc)",lineHeight:1}}>{fmt(totals.grandRounded)}</span>
            </div>
          </div>

          {/* Tab Content */}
          {tab==="details"&&<div className="fi">
            <div className="form-2col">
              <div style={{position:"relative"}}>
                <label className="lbl">Customer / Party *</label>
                <input className="inp" placeholder="Search by name…" value={pSearch} onChange={e=>{setPSearch(e.target.value);setShowP(true);if(!e.target.value)sf({party:null});}} onFocus={()=>setShowP(true)} onBlur={()=>setTimeout(()=>setShowP(false),200)}/>
                {form.party&&<div style={{fontSize:11,color:"var(--green)",marginTop:4}}>✓ {form.party.name}{isReg&&form.party.gstin?" · "+form.party.gstin:""}</div>}
                {showP&&pSearch&&<div style={{position:"absolute",top:"calc(100% + 5px)",left:0,right:0,background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,zIndex:60,overflow:"hidden",boxShadow:"var(--shadow-lg)"}}>
                  {fParties.length===0?<div style={{padding:"11px 14px",fontSize:12,color:"var(--muted)"}}>No match</div>:fParties.map(c=><div key={c.id} className="trow" style={{padding:"10px 14px",cursor:"pointer"}} onMouseDown={()=>{sf({party:c});setPSearch(c.name);setShowP(false);}}><div style={{fontWeight:600,fontSize:13}}>{c.name}</div></div>)}
                </div>}
              </div>
              <div className="form-2col" style={{gap:8}}>
                <div><label className="lbl">Date</label><input type="date" className="inp" value={form.invoiceDate} onChange={e=>sf({invoiceDate:e.target.value})}/></div>
                <div><label className="lbl">Due Date</label><input type="date" className="inp" value={form.dueDate||""} onChange={e=>sf({dueDate:e.target.value})}/></div>
              </div>
            </div>
          </div>}

          {tab==="items"&&<div className="fi">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <label className="lbl" style={{margin:0}}>Line Items</label>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-ghost btn-sm" onClick={addLine}>+ Add Row</button>
              </div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginBottom:4}}>
              <div style={{minWidth: useGST ? 700 : 520}}>
                <div style={{display:"grid",gridTemplateColumns:`2.2fr${useGST?" 65px 60px":""} 52px 56px 76px 62px${useGST?" 56px":""} 26px`,gap:4,padding:"5px 8px",borderBottom:"1px solid var(--border2)",marginBottom:2}}>
                  {["Item",...(useGST?["HSN","GST%"]:[]),"Qty","Unit","Rate ₹","Disc%",...(useGST?["Tax ₹"]:[]),""].map((h,i)=><div key={i} className="thead-cell" style={{textAlign:i===0?"left":"center",fontSize:10}}>{h}</div>)}
                </div>
                <div style={{maxHeight:240,overflowY:"auto"}}>
                  {lines.map((li,idx)=>(
                    <div key={li.id} style={{position:"relative"}}>
                      <div style={{display:"grid",gridTemplateColumns:`2.2fr${useGST?" 65px 60px":""} 52px 56px 76px 62px${useGST?" 56px":""} 26px`,gap:4,padding:"4px 8px",alignItems:"center",borderBottom:"1px solid var(--border2)"}}>
                        <div style={{position:"relative"}}>
                          <input className="inp inp-sm" placeholder="Item name…" value={li.name} onChange={e=>{updL(li.id,"name",e.target.value);setShowItem(li.id);setIQ(e.target.value);}} onFocus={()=>{setShowItem(li.id);setIQ(li.name);}} onBlur={()=>setTimeout(()=>setShowItem(null),200)}/>
                        </div>
                        {useGST&&<input className="inp inp-sm" style={{textAlign:"center"}} placeholder="HSN" value={li.hsnCode||li.sacCode||""} onChange={e=>updL(li.id,"hsnCode",e.target.value)}/>}
                        {useGST&&<select className="inp inp-sm" value={li.gstRate} onChange={e=>updL(li.id,"gstRate",+e.target.value)}>{GST_RATES.map(r=><option key={r} value={r}>{r}%</option>)}</select>}
                        <input type="number" className="inp inp-sm" style={{textAlign:"center"}} value={li.qty} onChange={e=>updL(li.id,"qty",e.target.value)} min="0" step="0.01"/>
                        <select className="inp inp-sm" value={li.unit} onChange={e=>updL(li.id,"unit",e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select>
                        <input type="number" className="inp inp-sm" style={{textAlign:"right"}} value={li.rate} onChange={e=>updL(li.id,"rate",e.target.value)} min="0" step="0.01"/>
                        <div style={{position:"relative"}}>
                          <input type="number" className="inp inp-sm" style={{textAlign:"center",paddingRight:20,background:+li.disc>0?"rgba(63,185,80,.1)":"",borderColor:+li.disc>0?"rgba(63,185,80,.4)":"",color:+li.disc>0?"var(--green)":""}} value={li.disc||0} onChange={e=>updL(li.id,"disc",e.target.value)} min="0" max="100"/>
                          <div style={{position:"absolute",right:5,top:"50%",transform:"translateY(-50%)",fontSize:10,color:+li.disc>0?"var(--green)":"var(--muted2)",fontWeight:700,pointerEvents:"none"}}>%</div>
                        </div>
                        {useGST&&<div className="mono" style={{textAlign:"center",fontSize:11,color:"var(--purple)"}}>{fmtN(calcedLines[idx]?.taxAmt||0)}</div>}
                        <button className="btn btn-danger btn-xs" style={{padding:"3px",width:22,height:22}} onClick={()=>remLine(li.id)}>✕</button>
                        {showItem===li.id&&iQuery&&<div style={{position:"absolute",top:"100%",left:0,width:310,background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,zIndex:70,overflow:"hidden",boxShadow:"var(--shadow-lg)"}}>
                          {fItems(iQuery).length===0?<div style={{padding:"10px 13px",fontSize:12,color:"var(--muted)"}}>No match</div>:fItems(iQuery).map(item=><div key={item.id} className="trow" style={{padding:"8px 13px",cursor:"pointer"}} onMouseDown={()=>pickItem(li.id,item)}><div style={{fontWeight:600,fontSize:12}}>{item.name}</div><div style={{fontSize:10,color:"var(--muted)"}}>₹{fmtN(item.salePrice)}</div></div>)}
                        </div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
              <div style={{background:"var(--bg3)",border:"1px solid var(--acc-border)",borderRadius:11,padding:"14px 18px",width:"100%",maxWidth:280,minWidth:220}}>
                {useGST&&totals.subtotal!==totals.grandRounded&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><span style={{fontSize:12,color:"var(--muted)"}}>Subtotal</span><span className="mono" style={{fontSize:12}}>{fmt(totals.subtotal)}</span></div>}
                {useGST&&totals.totalCGST>0&&<><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,color:"var(--muted)"}}>CGST</span><span className="mono" style={{fontSize:11,color:"var(--purple)"}}>{fmt(totals.totalCGST)}</span></div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,color:"var(--muted)"}}>SGST</span><span className="mono" style={{fontSize:11,color:"var(--purple)"}}>{fmt(totals.totalSGST)}</span></div></>}
                {useGST&&totals.totalIGST>0&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,color:"var(--muted)"}}>IGST</span><span className="mono" style={{fontSize:11,color:"var(--purple)"}}>{fmt(totals.totalIGST)}</span></div>}
                {lines.some(l=>+l.disc>0)&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}><span style={{fontSize:11,color:"var(--green)"}}>💚 Discount</span><span className="mono" style={{fontSize:11,color:"var(--green)"}}>−{fmt(lines.reduce((a,l)=>a+(+l.qty||0)*(+l.rate||0)*(+l.disc||0)/100,0))}</span></div>}
                <div style={{borderTop:"1px solid var(--acc-border)",paddingTop:9,marginTop:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span className="out" style={{fontWeight:800,fontSize:13}}>TOTAL</span><span className="out mono" style={{fontWeight:900,fontSize:20,color:"var(--acc)"}}>{fmt(totals.grandRounded)}</span>
                </div>
              </div>
            </div>
          </div>}

          {tab==="more"&&<div className="fi">
            <div className="form-2col">
              <div><label className="lbl">PO / Reference</label><input className="inp" value={form.poNumber||""} onChange={e=>sf({poNumber:e.target.value})}/></div>
              <div><label className="lbl">Shipping Address</label><input className="inp" value={form.shipTo||""} onChange={e=>sf({shipTo:e.target.value})}/></div>
              <div style={{gridColumn:"span 2"}}><label className="lbl">Notes for Customer</label><textarea className="inp" value={form.notes||""} onChange={e=>sf({notes:e.target.value})}/></div>
              <div><label className="lbl">Recurring 🔁</label><select className="inp" value={form.recurring||""} onChange={e=>sf({recurring:e.target.value||null})}><option value="">None</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></div>
              <div><label className="lbl">Payment Mode</label><select className="inp" value={form.paymentMode||""} onChange={e=>sf({paymentMode:e.target.value})}><option value="">Not set</option>{PAY_MODES.map(m=><option key={m}>{m}</option>)}</select></div>
            </div>
          </div>}
        </div>

        {/* Sticky Action Footer */}
        <div style={{padding:"14px 24px", background:"var(--bg2)", borderTop:"1px solid var(--border)", display:"flex", gap:10, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end"}}>
          <button className="btn btn-ghost btn-sm" onClick={()=>doSave("draft")}>💾 Draft</button>
          <button className="btn btn-p" style={{padding:"9px 22px"}} onClick={()=>doSave("unpaid")}>✓ Save {docType.label}</button>
        </div>
      </div>
    </div>
  );
};

// ─── DASHBOARD ────────────────────────────────────────────────
const Dashboard = ({invoices, customers, items, expenses, business, onNew, setPage, onAutoRemind}) => {
  const now=new Date(),td=today();
  const mStart=new Date(now.getFullYear(),now.getMonth(),1).toISOString().split("T")[0];
  const prevMStart=new Date(now.getFullYear(),now.getMonth()-1,1).toISOString().split("T")[0];
  const prevMEnd=new Date(now.getFullYear(),now.getMonth(),0).toISOString().split("T")[0];
  const isGst=business?.isGstRegistered;
  const todaySales=invoices.filter(i=>i.invoiceDate===td&&i.status!=="draft").reduce((a,i)=>a+i.grandRounded,0);
  const mthInvs=invoices.filter(i=>i.invoiceDate>=mStart&&i.status!=="draft");
  const monthSales=mthInvs.reduce((a,i)=>a+i.grandRounded,0);
  const prevMSales=invoices.filter(i=>i.invoiceDate>=prevMStart&&i.invoiceDate<=prevMEnd&&i.status!=="draft").reduce((a,i)=>a+i.grandRounded,0);
  const mTrend=prevMSales>0?Math.round((monthSales-prevMSales)/prevMSales*100):null;
  const outstanding=invoices.filter(i=>["unpaid","overdue","partial"].includes(i.status)).reduce((a,i)=>a+(i.grandRounded-(i.amountPaid||0)),0);
  const overdueN=invoices.filter(i=>i.status==="overdue").length;
  const collected=invoices.filter(i=>i.invoiceDate>=mStart&&i.status==="paid").reduce((a,i)=>a+i.grandRounded,0);
  const mthExp=expenses.filter(e=>e.date>=mStart).reduce((a,e)=>a+e.amount,0);
  const grossProfit=monthSales-mthExp;
  const chart=Array.from({length:6},(_,i)=>{
    const m=new Date(now.getFullYear(),now.getMonth()-5+i,1);
    const key=`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,"0")}`;
    const inv=invoices.filter(iv=>iv.invoiceDate?.startsWith(key)&&iv.status!=="draft");
    return{month:MONTHS[m.getMonth()],sales:inv.reduce((a,i)=>a+i.grandRounded,0),paid:inv.filter(i=>i.status==="paid").reduce((a,i)=>a+i.grandRounded,0),exp:expenses.filter(e=>e.date?.startsWith(key)).reduce((a,e)=>a+e.amount,0)};
  });
  const pieData=[
    {n:"Paid",v:invoices.filter(i=>i.status==="paid").length,c:"var(--green)"},
    {n:"Unpaid",v:invoices.filter(i=>i.status==="unpaid").length,c:"#F0B429"},
    {n:"Overdue",v:invoices.filter(i=>i.status==="overdue").length,c:"var(--red)"},
  ].filter(d=>d.v>0);
  const recent=[...invoices].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  const topCusts=customers.map(c=>{const ci=invoices.filter(i=>i.party?.id===c.id||i.party?.name===c.name);return{...c,total:ci.reduce((a,i)=>a+i.grandRounded,0),count:ci.length};}).sort((a,b)=>b.total-a.total).slice(0,5);
  const fyStart=`${now.getMonth()>=3?now.getFullYear():now.getFullYear()-1}-04-01`;
  const fyEarned=invoices.filter(i=>i.invoiceDate>=fyStart&&i.status!=="draft").reduce((a,i)=>a+i.grandRounded,0);
  const tPct=Math.min((fyEarned/2000000)*100,100);

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div>
          <div className="out page-title" style={{fontSize:"1.5rem",fontWeight:900}}>{now.getHours()<12?"Good Morning":"Good Afternoon"} 👋</div>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:3,display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            {business?.name}
            <span className="tag" style={{background:isGst?"rgba(88,166,255,.1)":"rgba(63,185,80,.1)",color:isGst?"var(--blue)":"var(--green)",border:`1px solid ${isGst?"rgba(88,166,255,.2)":"rgba(63,185,80,.2)"}`}}>{isGst?"🏷 GST":"✅ Non-GST"}</span>
            {overdueN>0&&<span className="tag tag-o pulse">{overdueN} Overdue!</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0}}>
          {overdueN>0&&<button className="btn btn-ghost btn-sm" style={{color:"#25D366"}} onClick={onAutoRemind}>💬 Remind</button>}
          <button className="btn btn-p" style={{padding:"10px 20px"}} onClick={onNew}>+ New {isGst?"Invoice":"Bill"}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Today's Sales"  val={fmt(todaySales)}  color="var(--acc)"   icon="📈" delay={0}/>
        <KPI label="This Month"     val={fmt(monthSales)}  color="var(--green)" icon="📅" delay={50} trend={mTrend}/>
        <KPI label="Collected"      val={fmt(collected)}   color="var(--blue)"  icon="✅" delay={100}/>
        <KPI label="Outstanding"    val={fmt(outstanding)} color={outstanding>0?"#F0B429":"var(--green)"} icon="⏳" delay={150}/>
        {isGst
          ?<KPI label="Profit Est." val={fmt(grossProfit)} color={grossProfit>=0?"var(--green)":"var(--red)"} icon="💰" delay={200}/>
          :<div className="card fi" style={{padding:"16px 18px",animationDelay:"200ms",borderLeft:`2.5px solid ${tPct>=100?"var(--red)":tPct>=80?"#F0B429":"var(--green)"}`}}>
            <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",marginBottom:6}}>GST Threshold</div>
            <div className="out kpi-val" style={{fontSize:"1.4rem",fontWeight:800}}>{fmt(fyEarned)}</div>
            <div style={{height:4,background:"var(--bg4)",borderRadius:2,marginTop:6,overflow:"hidden"}}><div style={{height:"100%",width:`${tPct}%`,background:tPct>=100?"var(--red)":tPct>=80?"#F0B429":"var(--green)",borderRadius:2}}/></div>
          </div>
        }
      </div>

      <div className="card" style={{padding:"16px 18px",marginBottom:14}}>
        <div style={{fontSize:10,color:"var(--muted)",fontWeight:700,textTransform:"uppercase",marginBottom:12}}>Quick Actions</div>
        <div className="qa-grid">
          {[
            {icon:"🧾",label:"New Bill", color:"var(--acc)",    action:()=>onNew()},
            {icon:"👥",label:"Customer", color:"var(--blue)",  action:()=>setPage("customers")},
            {icon:"📦",label:"Items",    color:"var(--green)", action:()=>setPage("items")},
            {icon:"💸",label:"Expense",  color:"#F87171",      action:()=>setPage("expenses")},
            {icon:"🧮",label:"Calc",     color:"var(--purple)",action:()=>setPage("calculator")},
            {icon:"📊",label:"Reports",  color:"#F0B429",      action:()=>setPage("reports")},
            {icon:"🎓",label:"Ask CA",   color:"#25D366",      action:()=>setPage("askca")},
            {icon:"⚙️",label:"Settings", color:"var(--muted)", action:()=>setPage("settings")},
          ].map((a,i)=>(
            <button key={i} className="btn" onClick={a.action} style={{flexDirection:"column",gap:5,padding:"11px 6px",background:"var(--bg3)",border:"1px solid var(--border2)",borderRadius:11,height:70}} onMouseEnter={e=>{e.currentTarget.style.background="var(--bg4)";e.currentTarget.style.borderColor=a.color;}} onMouseLeave={e=>{e.currentTarget.style.background="var(--bg3)";e.currentTarget.style.borderColor="var(--border2)";}}>
              <span style={{fontSize:20}}>{a.icon}</span><span style={{fontSize:10,fontWeight:600,color:"var(--muted)"}}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="chart-grid">
        <div className="card" style={{padding:20}}>
          <div className="out" style={{fontWeight:700,fontSize:13,marginBottom:16}}>Revenue vs Expenses</div>
          <ResponsiveContainer width="100%" height={170}>
            <ComposedChart data={chart} margin={{top:4,right:0,left:0,bottom:0}}>
              <defs><linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--acc)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--acc)" stopOpacity={0}/></linearGradient></defs>
              <XAxis dataKey="month" tick={{fill:"var(--muted)",fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"var(--muted)",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>v>=1000?`₹${v/1000}k`:`₹${v}`}/>
              <Tooltip contentStyle={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:9,fontSize:11}}/>
              <Area type="monotone" dataKey="sales" stroke="var(--acc)" strokeWidth={2} fill="url(#gS)"/>
              <Bar dataKey="exp" fill="rgba(248,81,73,.35)"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="card" style={{padding:20}}>
          <div className="out" style={{fontWeight:700,fontSize:13,marginBottom:12}}>Status</div>
          {pieData.length===0?<Empty icon="📄" title="No bills" sub=""/>:
            <ResponsiveContainer width="100%" height={110}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={50} dataKey="v" paddingAngle={4}>{pieData.map((d,i)=><Cell key={i} fill={d.c}/>)}</Pie>
                <Tooltip contentStyle={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:8,fontSize:11}}/>
              </PieChart>
            </ResponsiveContainer>
          }
        </div>
      </div>

      <div className="bottom-grid">
        <div className="card" style={{padding:20}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}><div className="out" style={{fontWeight:700,fontSize:13}}>Recent Bills</div><button className="btn btn-ghost btn-sm" onClick={()=>setPage("invoices")}>All →</button></div>
          {recent.map(inv=><div key={inv.id} className="trow" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",gap:8}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,fontSize:12}}>{inv.invoiceNumber}</div><div style={{fontSize:11,color:"var(--muted)"}}>{inv.party?.name||"—"}</div></div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}><SBadge s={inv.status}/><div className="mono" style={{fontWeight:700,fontSize:12,color:"var(--acc)"}}>{fmt(inv.grandRounded)}</div></div>
          </div>)}
        </div>
        <div className="card" style={{padding:20}}>
          <div className="out" style={{fontWeight:700,fontSize:13,marginBottom:12}}>Top Customers</div>
          {topCusts.filter(c=>c.total>0).map((c,i)=><div key={c.id} className="trow" style={{display:"flex",alignItems:"center",gap:9,padding:"8px 0"}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:`hsl(${i*72},50%,46%)`,display:"grid",placeItems:"center",fontSize:11,fontWeight:700,color:"#fff"}}>{c.name[0]}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600}}>{c.name}</div></div>
            <div className="mono" style={{fontSize:12,fontWeight:700,color:"var(--acc)"}}>{fmt(c.total)}</div>
          </div>)}
        </div>
      </div>
    </div>
  );
};

// ─── INVOICES LIST ────────────────────────────────────────────
const InvoicesList = ({invoices, onNew, onEdit, onDelete, onPay, onDuplicate, business}) => {
  const [search,setSrch]=useState("");
  const [filt,setFilt]=useState("all");
  const [view,setView]=useState(null);
  const [payI,setPayI]=useState(null);
  const [payAmt,setPayAmt]=useState("");
  const list=invoices.filter(i=>{const ms=(i.invoiceNumber||"").toLowerCase().includes(search.toLowerCase())||(i.party?.name||"").toLowerCase().includes(search.toLowerCase());return ms&&(filt==="all"||i.status===filt);}).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const doPay=()=>{const a=+payAmt;if(!a||!payI)return;const np=(payI.amountPaid||0)+a;onPay(payI.id,{amountPaid:np,status:np>=payI.grandRounded?"paid":np>0?"partial":"unpaid"});setPayI(null);setPayAmt("");};
  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div className="out page-title" style={{fontSize:"1.4rem",fontWeight:800}}>All Documents</div>
        <button className="btn btn-p" onClick={onNew}>+ New Document</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <input className="inp" style={{maxWidth:260}} placeholder="🔍 Invoice #, party…" value={search} onChange={e=>setSrch(e.target.value)}/>
        {["all","paid","unpaid","overdue","partial","draft"].map(s=>(<button key={s} className="btn btn-sm" onClick={()=>setFilt(s)} style={{textTransform:"capitalize",background:filt===s?"var(--acc-bg)":"var(--bg3)",color:filt===s?"var(--acc)":"var(--muted)",border:`1px solid ${filt===s?"var(--acc-border)":"var(--border2)"}`}}>{s}</button>))}
      </div>
      {list.length===0?<Empty icon="📄" title="No documents found" sub="" cta="+ New Document" onCta={onNew}/>:(
        <div className="tbl-wrap card">
          <div style={{display:"grid",gridTemplateColumns:"1.1fr 1.7fr 0.8fr 0.85fr 0.72fr 1.35fr",padding:"8px 16px",borderBottom:"1px solid var(--border)",minWidth:560}}>
            {["Doc #","Party","Date","Amount","Status","Actions"].map((h,i)=><div key={i} className="thead-cell" style={{textAlign:i>3?"center":"left"}}>{h}</div>)}
          </div>
          {list.map(inv=>(
            <div key={inv.id} className="trow" style={{display:"grid",gridTemplateColumns:"1.1fr 1.7fr 0.8fr 0.85fr 0.72fr 1.35fr",padding:"10px 16px",alignItems:"center",minWidth:560}}>
              <div><div style={{fontWeight:700,fontSize:12.5,color:"var(--acc)",cursor:"pointer"}} onClick={()=>setView(inv)}>{inv.invoiceNumber}</div></div>
              <div><div style={{fontWeight:600,fontSize:12.5}}>{inv.party?.name||"—"}</div></div>
              <div style={{fontSize:12,color:"var(--muted)"}}>{inv.invoiceDate}</div>
              <div style={{textAlign:"center"}}><div className="mono" style={{fontWeight:700,fontSize:12}}>{fmt(inv.grandRounded)}</div></div>
              <div style={{textAlign:"center"}}><SBadge s={inv.status}/></div>
              <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                <button className="btn btn-xs" style={{background:"var(--acc-bg)",color:"var(--acc)",border:"1px solid var(--acc-border)"}} onClick={()=>onEdit(inv)}>✏</button>
                <button className="btn btn-xs" style={{background:"rgba(88,166,255,.1)",color:"var(--blue)",border:"1px solid rgba(88,166,255,.2)"}} onClick={()=>setView(inv)}>👁</button>
                <button className="btn btn-xs" style={{background:"rgba(63,185,80,.1)",color:"var(--green)",border:"1px solid rgba(63,185,80,.2)"}} onClick={()=>{setPayI(inv);setPayAmt(String(Math.max(inv.grandRounded-(inv.amountPaid||0),0)));}}>₹</button>
                <button className="btn btn-danger btn-xs" onClick={()=>onDelete(inv.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {view&&<InvoiceModal inv={view} business={business} onClose={()=>setView(null)} previewModeOnly={true}/>}
      {payI&&<div className="overlay" onClick={()=>setPayI(null)}>
        <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
          <div className="out" style={{fontSize:17,fontWeight:800,marginBottom:16}}>💰 Record Payment</div>
          <div style={{background:"var(--bg3)",borderRadius:10,padding:"13px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:"var(--muted)"}}>Total</span><span className="mono">{fmt(payI.grandRounded)}</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"var(--muted)"}}>Due</span><span className="mono" style={{color:"var(--red)"}}>{fmt(payI.grandRounded-(payI.amountPaid||0))}</span></div>
          </div>
          <div style={{marginBottom:16}}><label className="lbl">Amount (₹)</label><input type="number" className="inp" value={payAmt} onChange={e=>setPayAmt(e.target.value)} autoFocus/></div>
          <div style={{display:"flex",gap:8}}><button className="btn btn-ghost" onClick={()=>setPayI(null)} style={{flex:1}}>Cancel</button><button className="btn btn-p" onClick={doPay} style={{flex:1}}>✓ Record</button></div>
        </div>
      </div>}
    </div>
  );
};

// ─── CUSTOMERS ────────────────────────────────────────────────
const Customers = ({customers, invoices, business, onSave, onDelete}) => {
  const [show,setShow]=useState(false);
  const [editC,setEditC]=useState(null);
  const [search,setSearch]=useState("");
  const blank={name:"",gstin:"",phone:"",email:"",address:{city:"",state:""},type:"customer",openingBalance:0,notes:""};
  const [form,setForm]=useState(blank);
  const sf=f=>setForm(p=>({...p,...f}));
  const save=()=>{onSave({...form,id:editC?.id||"C"+uid()});setShow(false);setEditC(null);};
  const list=customers.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search));
  
  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div className="out page-title" style={{fontSize:"1.4rem",fontWeight:800}}>Customers & Parties</div>
        <button className="btn btn-p" onClick={()=>{setForm(blank);setEditC(null);setShow(true);}}>+ Add Party</button>
      </div>
      <input className="inp" style={{maxWidth:280,marginBottom:16}} placeholder="🔍 Search by name or phone…" value={search} onChange={e=>setSearch(e.target.value)}/>
      {list.length===0?<Empty icon="👥" title="No parties yet" sub="Add your first customer" cta="+ Add Party" onCta={()=>setShow(true)}/>:(
        <div className="cust-grid">
          {list.map(c=>(
            <div key={c.id} className="card" style={{padding:18}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:40,height:40,borderRadius:11,background:`hsl(${c.name.charCodeAt(0)*7},48%,40%)`,display:"grid",placeItems:"center",fontSize:14,fontWeight:800,color:"#fff"}}>{c.name[0]}</div>
                  <div><div style={{fontWeight:700,fontSize:13}}>{c.name}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>{c.phone||"No phone"}</div></div>
                </div>
                <div style={{display:"flex",gap:4}}>
                  <button className="btn btn-ghost btn-xs" onClick={()=>{setForm(c);setEditC(c);setShow(true);}}>✏</button>
                  <button className="btn btn-danger btn-xs" onClick={()=>onDelete(c.id)}>✕</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {show&&<div className="overlay" onClick={()=>setShow(false)}>
        <div className="modal" style={{maxWidth:520, padding:0, display:"flex", flexDirection:"column", overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:"20px 24px", overflowY:"auto", maxHeight:"calc(90vh - 70px)"}}>
            <div className="out" style={{fontSize:17,fontWeight:800,marginBottom:18}}>{editC?"Edit":"Add"} Party</div>
            <div className="form-2col" style={{marginBottom:14}}>
              <div style={{gridColumn:"span 2"}}><label className="lbl">Name *</label><input className="inp" value={form.name} onChange={e=>sf({name:e.target.value})} autoFocus/></div>
              <div><label className="lbl">Phone</label><input className="inp" value={form.phone||""} onChange={e=>sf({phone:e.target.value})}/></div>
              <div><label className="lbl">City</label><input className="inp" value={form.address?.city||""} onChange={e=>sf({address:{...form.address,city:e.target.value}})}/></div>
              {business?.isGstRegistered&&<div style={{gridColumn:"span 2"}}><label className="lbl">GSTIN</label><input className="inp" value={form.gstin||""} onChange={e=>sf({gstin:e.target.value.toUpperCase()})}/></div>}
            </div>
          </div>
          <div style={{padding:"14px 24px", background:"var(--bg2)", borderTop:"1px solid var(--border)", display:"flex", gap:10, flexShrink:0}}>
            <button className="btn btn-ghost" onClick={()=>setShow(false)} style={{flex:1}}>Cancel</button>
            <button className="btn btn-p" onClick={save} style={{flex:2}}>✓ Save Party</button>
          </div>
        </div>
      </div>}
    </div>
  );
};

// ─── ITEMS ────────────────────────────────────────────────────
const Items = ({items, business, onSave, onDelete}) => {
  const [show,setShow]=useState(false);
  const [editI,setEditI]=useState(null);
  const [search,setSearch]=useState("");
  const isGst=business?.isGstRegistered;
  const blank={name:"",type:"product",hsnCode:"",sacCode:"",gstRate:0,unit:"pcs",salePrice:0,purchasePrice:0,stock:0,lowStock:10};
  const [form,setForm]=useState(blank);
  const sf=f=>setForm(p=>({...p,...f}));
  const list=items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()));
  const save=()=>{if(!form.name.trim())return alert("Name required!"); onSave({...form,id:editI?.id||"I"+uid()}); setShow(false); setEditI(null);};
  const margin=i=>i.purchasePrice>0?Math.round((i.salePrice-i.purchasePrice)/i.salePrice*100):null;
  
  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div className="out page-title" style={{fontSize:"1.4rem",fontWeight:800}}>Items & Services</div>
        <button className="btn btn-p" onClick={()=>{setForm(blank);setEditI(null);setShow(true);}}>+ Add Item</button>
      </div>
      <input className="inp" style={{maxWidth:240,marginBottom:14}} placeholder="🔍 Search items…" value={search} onChange={e=>setSearch(e.target.value)}/>
      {list.length===0?<Empty icon="📦" title="No items found" sub="Add products and services" cta="+ Add Item" onCta={()=>setShow(true)}/>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
          {list.map(item=>(
            <div key={item.id} className="card fi" style={{padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div style={{paddingRight:10}}>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{item.name}</div>
                  <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{item.type==="product"?"📦 Product":"⚙️ Service"} · {item.unit} {isGst&&`· GST ${item.gstRate}%`}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button className="btn btn-ghost btn-xs" onClick={()=>{setForm(item);setEditI(item);setShow(true);}}>✏</button>
                  <button className="btn btn-danger btn-xs" onClick={()=>onDelete(item.id)}>✕</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,background:"var(--bg3)",padding:"10px",borderRadius:8}}>
                <div><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase"}}>Sale</div><div className="mono" style={{fontSize:13,fontWeight:700,color:"var(--acc)"}}>{fmt(item.salePrice)}</div></div>
                <div><div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase"}}>Cost</div><div className="mono" style={{fontSize:12,color:"var(--text2)"}}>{item.purchasePrice?fmt(item.purchasePrice):"—"}</div></div>
                <div>
                  <div style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase"}}>{item.type==="product"?"Stock":"Margin"}</div>
                  {item.type==="product"?<div style={{fontSize:13,fontWeight:700,color:item.stock<=item.lowStock?"var(--red)":"var(--green)"}}>{item.stock}</div>:<div style={{fontSize:12,fontWeight:700,color:"var(--green)"}}>{margin(item)?margin(item)+"%":"—"}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {show&&<div className="overlay" onClick={()=>setShow(false)}>
        <div className="modal" style={{maxWidth:500, padding:0, overflow:"hidden", display:"flex", flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:"20px 24px", overflowY:"auto", maxHeight:"calc(90vh - 70px)"}}>
            <div className="out" style={{fontSize:17,fontWeight:800,marginBottom:18}}>{editI?"Edit":"Add"} Item</div>
            <div className="form-2col" style={{marginBottom:14}}>
              <div style={{gridColumn:"span 2"}}><label className="lbl">Name *</label><input className="inp" value={form.name} onChange={e=>sf({name:e.target.value})}/></div>
              <div><label className="lbl">Type</label><select className="inp" value={form.type} onChange={e=>sf({type:e.target.value})}><option value="product">Product / Goods</option><option value="service">Service</option></select></div>
              <div><label className="lbl">Unit</label><select className="inp" value={form.unit} onChange={e=>sf({unit:e.target.value})}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></div>
              {isGst&&<>{form.type==="product"?<div><label className="lbl">HSN Code</label><input className="inp" value={form.hsnCode||""} onChange={e=>sf({hsnCode:e.target.value})}/></div>:<div><label className="lbl">SAC Code</label><input className="inp" value={form.sacCode||""} onChange={e=>sf({sacCode:e.target.value})}/></div>}<div><label className="lbl">GST Rate</label><select className="inp" value={form.gstRate} onChange={e=>sf({gstRate:+e.target.value})}>{GST_RATES.map(r=><option key={r} value={r}>{r}%</option>)}</select></div></>}
              <div><label className="lbl">Sale Price (₹)</label><input type="number" className="inp" value={form.salePrice} onChange={e=>sf({salePrice:+e.target.value})}/></div>
              <div><label className="lbl">Cost Price (₹)</label><input type="number" className="inp" value={form.purchasePrice} onChange={e=>sf({purchasePrice:+e.target.value})}/></div>
              {form.type==="product"&&<><div><label className="lbl">Current Stock</label><input type="number" className="inp" value={form.stock} onChange={e=>sf({stock:+e.target.value})}/></div><div><label className="lbl">Low Stock Alert</label><input type="number" className="inp" value={form.lowStock} onChange={e=>sf({lowStock:+e.target.value})}/></div></>}
            </div>
          </div>
          <div style={{padding:"14px 24px", background:"var(--bg2)", borderTop:"1px solid var(--border)", display:"flex", gap:10, flexShrink:0}}>
            <button className="btn btn-ghost" onClick={()=>setShow(false)} style={{flex:1}}>Cancel</button>
            <button className="btn btn-p" onClick={save} style={{flex:2}}>✓ Save Item</button>
          </div>
        </div>
      </div>}
    </div>
  );
};

// ─── EXPENSES ─────────────────────────────────────────────────
const Expenses = ({expenses, onSave, onDelete}) => {
  const [show,setShow]=useState(false);
  const [editE,setEditE]=useState(null);
  const blank={category:"Office Supplies",amount:0,vendor:"",date:today(),paymentMode:"Cash",notes:"",receipt:null};
  const [form,setForm]=useState(blank);
  const sf=f=>setForm(p=>({...p,...f}));
  const save=()=>{onSave({...form,id:editE?.id||"E"+uid()});setShow(false);setEditE(null);};
  const list=[...expenses].sort((a,b)=>b.date.localeCompare(a.date));
  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div className="out page-title" style={{fontSize:"1.4rem",fontWeight:800}}>Expenses</div>
        <button className="btn btn-p" onClick={()=>{setForm(blank);setEditE(null);setShow(true);}}>+ Add Expense</button>
      </div>
      {list.length===0?<Empty icon="💸" title="No expenses yet" sub="" cta="+ Add Expense" onCta={()=>setShow(true)}/>:(
        <div className="tbl-wrap card">
          <div style={{display:"grid",gridTemplateColumns:"0.7fr 1.2fr 1.1fr 0.8fr 0.75fr 0.7fr",padding:"8px 16px",borderBottom:"1px solid var(--border)",minWidth:500}}>
            {["Date","Category","Vendor","Amount","Mode",""].map(h=><div key={h} className="thead-cell">{h}</div>)}
          </div>
          {list.map(exp=>(
            <div key={exp.id} className="trow" style={{display:"grid",gridTemplateColumns:"0.7fr 1.2fr 1.1fr 0.8fr 0.75fr 0.7fr",padding:"10px 16px",alignItems:"center",minWidth:500}}>
              <div style={{fontSize:12,color:"var(--muted)"}}>{exp.date}</div>
              <div><div style={{fontSize:12.5,fontWeight:600}}>{exp.category}</div></div>
              <div style={{fontSize:12.5}}>{exp.vendor||"—"}</div>
              <div className="mono" style={{fontSize:13,fontWeight:700,color:"var(--red)"}}>{fmt(exp.amount)}</div>
              <div><span className="tag tag-d" style={{fontSize:10}}>{exp.paymentMode}</span></div>
              <div style={{display:"flex",gap:4}}>
                <button className="btn btn-xs" style={{background:"var(--acc-bg)",color:"var(--acc)",border:"1px solid var(--acc-border)"}} onClick={()=>{setForm(exp);setEditE(exp);setShow(true);}}>✏</button>
                <button className="btn btn-danger btn-xs" onClick={()=>onDelete(exp.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {show&&<div className="overlay" onClick={()=>setShow(false)}>
        <div className="modal" style={{maxWidth:490, padding:0, display:"flex", flexDirection:"column", overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
          <div style={{padding:"20px 24px", overflowY:"auto", maxHeight:"calc(90vh - 70px)"}}>
            <div className="out" style={{fontSize:17,fontWeight:800,marginBottom:18}}>{editE?"Edit":"Add"} Expense</div>
            <div className="form-2col" style={{marginBottom:14}}>
              <div><label className="lbl">Category *</label><select className="inp" value={form.category} onChange={e=>sf({category:e.target.value})}>{EXP_CATS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label className="lbl">Amount (₹) *</label><input type="number" className="inp" value={form.amount} onChange={e=>sf({amount:+e.target.value})} autoFocus/></div>
              <div><label className="lbl">Vendor / Paid To</label><input className="inp" value={form.vendor||""} onChange={e=>sf({vendor:e.target.value})}/></div>
              <div><label className="lbl">Date</label><input type="date" className="inp" value={form.date} onChange={e=>sf({date:e.target.value})}/></div>
              <div><label className="lbl">Payment Mode</label><select className="inp" value={form.paymentMode} onChange={e=>sf({paymentMode:e.target.value})}>{PAY_MODES.map(m=><option key={m}>{m}</option>)}</select></div>
            </div>
          </div>
          <div style={{padding:"14px 24px", background:"var(--bg2)", borderTop:"1px solid var(--border)", display:"flex", gap:10, flexShrink:0}}>
            <button className="btn btn-ghost" onClick={()=>setShow(false)} style={{flex:1}}>Cancel</button>
            <button className="btn btn-p" onClick={save} style={{flex:2}}>✓ Save Expense</button>
          </div>
        </div>
      </div>}
    </div>
  );
};

// ─── LOCAL VENDOR CATEGORY MAP ────────────────────────────────
const VENDOR_CAT_MAP = [
  {keys:["petrol","fuel","pump","hp","bp","shell","ioc","indian oil","bharat","speed"],cat:"Travel & Fuel"},
  {keys:["msedcl","electricity","bijli","power","energy","bescom","tneb","torrent"],cat:"Utilities"},
  {keys:["restaurant","hotel","cafe","dhaba","biryani","pizza","zomato","swiggy","food"],cat:"Food & Dining"},
  {keys:["medic","pharma","chemist","clinic","hospital","doctor","health","apollo","mg"],cat:"Raw Material"},
  {keys:["stationery","paper","office","print","xerox","notebook","staple"],cat:"Office Supplies"},
  {keys:["transport","courier","logistic","delivery","dhl","fedex","dtdc","bluedart"],cat:"Transport"},
  {keys:["rent","landlord","lease","property"],cat:"Rent"},
  {keys:["software","aws","google","microsoft","adobe","saas","domain","hosting"],cat:"Software"},
  {keys:["market","advertis","facebook","ads","banner","print media"],cat:"Marketing"},
  {keys:["salary","wages","labour","staff","employee"],cat:"Salary"},
  {keys:["repair","service","maintainance","workshop","garage"],cat:"Repairs"},
  {keys:["gst","tax","tds","advance tax","challan","government"],cat:"Taxes & Fees"},
];
const guessCategory = vendor => {
  const v = (vendor||"").toLowerCase();
  for(const {keys,cat} of VENDOR_CAT_MAP) if(keys.some(k=>v.includes(k))) return cat;
  return "Other";
};

// Local canvas-based image analysis — extract candidate numbers from brightness map
const analyzeImageLocally = (dataUrl) => new Promise(resolve => {
  const img = new Image();
  img.onload = () => {
    const SCALE = Math.min(1, 640 / Math.max(img.width, img.height));
    const W = Math.round(img.width * SCALE), H = Math.round(img.height * SCALE);
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;

    // Build grayscale map & find contrast regions
    const gray = new Uint8Array(W * H);
    for(let i = 0; i < W * H; i++) gray[i] = Math.round(0.299*data[i*4]+0.587*data[i*4+1]+0.114*data[i*4+2]);

    // Scan bottom-right quadrant for large dark-on-light clusters (typical total area)
    let densestRow = -1, maxDark = 0;
    const qX = Math.floor(W * 0.4), qY = Math.floor(H * 0.5);
    for(let y = qY; y < H - 2; y++) {
      let darkCount = 0;
      for(let x = qX; x < W; x++) { if(gray[y*W+x] < 100) darkCount++; }
      if(darkCount > maxDark) { maxDark = darkCount; densestRow = y; }
    }

    // Extract a strip around the densest row as thumbnail
    const stripY = Math.max(0, densestRow - 20);
    const stripH = Math.min(60, H - stripY);
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = W; thumbCanvas.height = stripH;
    const tCtx = thumbCanvas.getContext("2d");
    tCtx.drawImage(img, 0, stripY / SCALE, img.width, stripH / SCALE, 0, 0, W, stripH);

    resolve({
      thumb: thumbCanvas.toDataURL(),
      thumbY: Math.round(stripY / SCALE),
      hasDenseRegion: maxDark > 5,
      imgW: img.width,
      imgH: img.height,
    });
  };
  img.onerror = () => resolve(null);
  img.src = dataUrl;
});

// ─── GST CALCULATOR & LOCAL BILL SCANNER ──────────────────────
const GstCalculator = ({ onSaveExpense, expenses }) => {
  const [tab, setTab] = useState("calc");
  const [amt, setAmt] = useState("");
  const [rate, setRate] = useState(18);
  const [mode, setMode] = useState("add");
  const [photo, setPhoto] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [expAmt, setExpAmt] = useState("");
  const [expVendor, setExpVendor] = useState("");
  const [expCat, setExpCat] = useState("Other");
  const [expDate, setExpDate] = useState(today());
  const [numPad, setNumPad] = useState(false);
  const [padVal, setPadVal] = useState("");
  const recentVendors = useMemo(()=>[...new Set((expenses||[]).map(e=>e.vendor).filter(Boolean))].slice(0,6),[expenses]);

  const val = parseFloat(amt) || 0;
  const taxable = mode === "add" ? val : val / (1 + rate / 100);
  const taxAmt = mode === "add" ? val * (rate / 100) : val - taxable;
  const total = mode === "add" ? val + taxAmt : val;

  const handleCapture = async e => {
    const f = e.target.files?.[0];
    if(!f) return;
    setProcessing(true);
    setAnalysis(null);
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target.result;
      setPhoto(dataUrl);
      // Guess category from filename
      const nameGuess = guessCategory(f.name);
      setExpCat(nameGuess);
      // Local canvas analysis
      const result = await analyzeImageLocally(dataUrl);
      setAnalysis(result);
      setProcessing(false);
    };
    reader.readAsDataURL(f);
  };

  const onVendorChange = v => { setExpVendor(v); const g=guessCategory(v); if(g!=="Other") setExpCat(g); };

  const applyPad = () => { setExpAmt(padVal); setNumPad(false); };
  const padPress = d => { if(d==="⌫") setPadVal(p=>p.slice(0,-1)); else if(d===".") { if(!padVal.includes(".")) setPadVal(p=>p+"."); } else setPadVal(p=>p+d); };

  const saveScannedBill = () => {
    if(!expAmt) return alert("Enter the bill amount!");
    onSaveExpense({id:"E"+uid(),category:expCat,amount:parseFloat(expAmt),vendor:expVendor,date:expDate,paymentMode:"Cash",notes:"Scanned from device",receipt:photo});
    setPhoto(null); setExpAmt(""); setExpVendor(""); setAnalysis(null); setExpDate(today()); setTab("calc");
  };

  return (
    <div className="fi" style={{maxWidth:620}}>
      <div className="out page-title" style={{fontSize:"1.4rem", fontWeight:800, marginBottom:20}}>🧮 GST Tools & Bill Scanner</div>
      <div style={{display:"flex", gap:8, marginBottom:16}}>
        <button className="btn" onClick={()=>setTab("calc")} style={{flex:1, background:tab==="calc"?"var(--acc-bg)":"var(--bg3)", color:tab==="calc"?"var(--acc)":"var(--muted)", border:`1px solid ${tab==="calc"?"var(--acc-border)":"var(--border2)"}`}}>🧮 GST Calculator</button>
        <button className="btn" onClick={()=>setTab("scan")} style={{flex:1, background:tab==="scan"?"rgba(26,107,196,.1)":"var(--bg3)", color:tab==="scan"?"var(--blue)":"var(--muted)", border:`1px solid ${tab==="scan"?"rgba(26,107,196,.3)":"var(--border2)"}`}}>📸 Bill Scanner</button>
      </div>

      {tab === "calc" && (
        <div className="card fi" style={{padding:20}}>
          <div style={{display:"flex", gap:10, marginBottom:16}}>
            <button className="btn" onClick={()=>setMode("add")} style={{flex:1, background:mode==="add"?"rgba(31,138,76,.12)":"var(--bg3)", color:mode==="add"?"var(--green)":"var(--muted)", border:`1px solid ${mode==="add"?"rgba(31,138,76,.3)":"var(--border)"}`}}>+ Add GST</button>
            <button className="btn" onClick={()=>setMode("remove")} style={{flex:1, background:mode==="remove"?"rgba(217,48,37,.12)":"var(--bg3)", color:mode==="remove"?"var(--red)":"var(--muted)", border:`1px solid ${mode==="remove"?"rgba(217,48,37,.3)":"var(--border)"}`}}>− Remove GST</button>
          </div>
          <label className="lbl">Base Amount (₹)</label>
          <input type="number" className="inp" style={{fontSize:22, fontWeight:700, padding:"12px 16px", marginBottom:16}} value={amt} onChange={e=>setAmt(e.target.value)} placeholder="0.00"/>
          <label className="lbl">GST Rate</label>
          <div style={{display:"flex", gap:6, flexWrap:"wrap", marginBottom:20}}>
            {[3, 5, 12, 18, 28].map(r => (
              <button key={r} className="btn btn-sm" onClick={()=>setRate(r)} style={{flex:1, background:rate===r?"var(--acc)":"var(--bg3)", color:rate===r?"#fff":"var(--text2)", border:`1px solid ${rate===r?"var(--acc)":"var(--border)"}`}}>{r}%</button>
            ))}
          </div>
          <div style={{background:"var(--bg3)", borderRadius:10, padding:"18px", border:"1px solid var(--border)"}}>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:10}}><span style={{color:"var(--muted)"}}>Taxable Amount</span><span className="mono" style={{fontWeight:600}}>{fmt(taxable)}</span></div>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}><span style={{color:"var(--muted)"}}>CGST ({rate/2}%)</span><span className="mono" style={{color:"var(--purple)"}}>{fmt(taxAmt/2)}</span></div>
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:8, paddingBottom:10, borderBottom:"1px solid var(--border2)"}}><span style={{color:"var(--muted)"}}>SGST ({rate/2}%)</span><span className="mono" style={{color:"var(--purple)"}}>{fmt(taxAmt/2)}</span></div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10}}>
              <span className="out" style={{fontWeight:800, fontSize:14}}>NET TOTAL</span>
              <span className="out mono" style={{fontWeight:900, fontSize:24, color:"var(--acc)"}}>{fmt(total)}</span>
            </div>
          </div>
        </div>
      )}

      {tab === "scan" && (
        <div className="card fi" style={{padding:20}}>
          {/* Privacy badge */}
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"rgba(31,138,76,.08)",border:"1px solid rgba(31,138,76,.18)",borderRadius:8,marginBottom:16,fontSize:11.5,color:"var(--green)",fontWeight:600}}>
            <span style={{fontSize:16}}>🔒</span>
            <span>100% On-Device · No internet required · Your bill never leaves your phone</span>
          </div>

          {!photo ? (
            <div>
              <div style={{textAlign:"center", padding:"20px 10px 24px"}}>
                <div style={{fontSize:52, marginBottom:12}}>📸</div>
                <div className="out" style={{fontSize:17, fontWeight:800, marginBottom:6}}>Capture Vendor Bill</div>
                <div style={{fontSize:13, color:"var(--muted)", marginBottom:20, lineHeight:1.6}}>Take a photo or upload a bill.<br/>Smart local analysis detects the total region.</div>
                <div style={{display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap"}}>
                  <label className="btn btn-p" style={{padding:"12px 28px", fontSize:14, cursor:"pointer"}}>
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleCapture}/>📷 Open Camera
                  </label>
                  <label className="btn btn-ghost" style={{padding:"12px 22px", fontSize:14, cursor:"pointer"}}>
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={handleCapture}/>📁 Upload Bill
                  </label>
                </div>
              </div>
              {/* Recent vendors quick-pick */}
              {recentVendors.length > 0 && <div style={{borderTop:"1px solid var(--border2)",paddingTop:14}}>
                <div className="lbl" style={{marginBottom:8}}>Recent Vendors</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {recentVendors.map(v=>(
                    <button key={v} className="btn btn-sm btn-ghost" onClick={()=>{setExpVendor(v);setExpCat(guessCategory(v));setTab("scan");setPhoto("manual");}}>{v}</button>
                  ))}
                </div>
              </div>}
            </div>
          ) : photo === "manual" ? (
            <div className="fi">
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                <button className="btn btn-ghost btn-sm" onClick={()=>setPhoto(null)}>← Back</button>
                <span style={{fontWeight:700,fontSize:13}}>Quick Manual Entry</span>
              </div>
              <ManualBillForm expAmt={expAmt} setExpAmt={setExpAmt} expVendor={expVendor} onVendorChange={onVendorChange} expCat={expCat} setExpCat={setExpCat} expDate={expDate} setExpDate={setExpDate} numPad={numPad} setNumPad={setNumPad} padVal={padVal} setPadVal={setPadVal} padPress={padPress} applyPad={applyPad} onSave={saveScannedBill}/>
            </div>
          ) : (
            <div className="fi">
              {/* Bill preview */}
              <div style={{position:"relative",marginBottom:14,borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}}>
                <img src={photo} alt="Bill" style={{width:"100%", maxHeight:200, objectFit:"cover", display:"block"}}/>
                {processing && <div style={{position:"absolute",inset:0,background:"rgba(26,47,94,.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"#fff"}}>
                  <Spinner size={24}/><span style={{fontWeight:700,fontSize:13}}>Analyzing bill locally…</span>
                </div>}
                {!processing && analysis?.hasDenseRegion && analysis.thumb && (
                  <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(26,47,94,.85)",padding:"8px 12px",display:"flex",alignItems:"center",gap:10}}>
                    <img src={analysis.thumb} alt="Total region" style={{height:36,borderRadius:4,border:"1.5px solid var(--acc)"}}/>
                    <div style={{fontSize:11,color:"#fff",lineHeight:1.5}}><span style={{color:"var(--acc)",fontWeight:700}}>📍 Possible total region detected</span><br/>Check bottom-right of your bill for the amount</div>
                  </div>
                )}
              </div>

              {!processing && (
                <ManualBillForm expAmt={expAmt} setExpAmt={setExpAmt} expVendor={expVendor} onVendorChange={onVendorChange} expCat={expCat} setExpCat={setExpCat} expDate={expDate} setExpDate={setExpDate} numPad={numPad} setNumPad={setNumPad} padVal={padVal} setPadVal={setPadVal} padPress={padPress} applyPad={applyPad} onSave={saveScannedBill}/>
              )}
              <button className="btn btn-ghost btn-sm" style={{marginTop:8,width:"100%"}} onClick={()=>{setPhoto(null);setAnalysis(null);}}>↩ Retake / Change Bill</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── MANUAL BILL FORM (shared by camera + manual modes) ────────
const ManualBillForm = ({expAmt,setExpAmt,expVendor,onVendorChange,expCat,setExpCat,expDate,setExpDate,numPad,setNumPad,padVal,setPadVal,padPress,applyPad,onSave}) => (
  <div>
    {/* Amount with numpad trigger */}
    <div style={{marginBottom:12}}>
      <label className="lbl">Bill Amount (₹) *</label>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <div style={{position:"relative",flex:1}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontWeight:700,fontSize:16,color:"var(--acc)"}}>₹</span>
          <input type="number" className="inp" style={{paddingLeft:30,fontSize:20,fontWeight:800,color:"var(--acc)"}} value={expAmt} onChange={e=>setExpAmt(e.target.value)} placeholder="0.00"/>
        </div>
        <button className="btn btn-ghost" style={{padding:"10px 14px",fontSize:18,flexShrink:0}} onClick={()=>{setPadVal(expAmt);setNumPad(n=>!n);}}>🔢</button>
      </div>
    </div>

    {/* Numpad overlay */}
    {numPad && <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,padding:14,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontWeight:700,fontSize:14,color:"var(--acc)"}}>₹ {padVal||"0"}</span>
        <button className="btn btn-ghost btn-xs" onClick={()=>setNumPad(false)}>✕</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8}}>
        {["7","8","9","4","5","6","1","2","3",".","0","⌫"].map(d=>(
          <button key={d} className="btn" style={{padding:"14px",fontSize:18,fontWeight:700,background:d==="⌫"?"rgba(217,48,37,.1)":"var(--bg4)",color:d==="⌫"?"var(--red)":"var(--text)",border:"1px solid var(--border)",borderRadius:8}} onClick={()=>padPress(d)}>{d}</button>
        ))}
      </div>
      <button className="btn btn-p" style={{width:"100%",padding:"12px",fontSize:15}} onClick={applyPad}>✓ Use ₹{padVal}</button>
    </div>}

    <div className="form-2col" style={{marginBottom:12}}>
      <div>
        <label className="lbl">Vendor / Shop Name</label>
        <input className="inp" value={expVendor} onChange={e=>onVendorChange(e.target.value)} placeholder="e.g. HP Petrol Pump"/>
      </div>
      <div>
        <label className="lbl">Date</label>
        <input type="date" className="inp" value={expDate} onChange={e=>setExpDate(e.target.value)}/>
      </div>
    </div>
    <div style={{marginBottom:16}}>
      <label className="lbl">Category {expCat!=="Other"&&<span style={{color:"var(--green)",marginLeft:4}}>✓ Auto-detected</span>}</label>
      <select className="inp" value={expCat} onChange={e=>setExpCat(e.target.value)}>
        {EXP_CATS.map(c=><option key={c}>{c}</option>)}
      </select>
    </div>
    <button className="btn btn-p" style={{width:"100%",padding:"13px",fontSize:14}} onClick={onSave}>✓ Save Expense</button>
  </div>
);

// ─── REPORTS ─────────────────────────────────────────────────
const Reports = ({invoices, expenses, business}) => {
  return(
    <div className="fi">
      <div className="out page-title" style={{fontSize:"1.4rem",fontWeight:800,marginBottom:20}}>Reports & Analytics</div>
      <Empty icon="📊" title="Reports Generation" sub="Summary of sales, aging, and P&L available in full version."/>
    </div>
  );
};

// ─── SETTINGS ─────────────────────────────────────────────────
const Settings = ({business, onSave}) => {
  const [form,setForm]=useState({...DEMO_BIZ,...business});
  const sf=f=>setForm(p=>({...p,...f}));
  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
        <div className="out page-title" style={{fontSize:"1.4rem",fontWeight:800}}>Settings</div>
        <button className="btn btn-p" style={{padding:"9px 22px"}} onClick={()=>onSave(form)}>✓ Save Changes</button>
      </div>
      <div className="card" style={{padding:20,marginBottom:16}}>
        <div className="out" style={{fontWeight:700,fontSize:13,marginBottom:14}}>GST Registration</div>
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          <button className="btn" style={{flex:1,padding:"12px",flexDirection:"column",gap:5,background:!form.isGstRegistered?"var(--acc-bg)":"var(--bg3)",border:`1.5px solid ${!form.isGstRegistered?"var(--acc-border)":"var(--border2)"}`,borderRadius:11}} onClick={()=>sf({isGstRegistered:false,gstin:""})}><span style={{fontSize:20}}>✅</span><span style={{fontSize:11,fontWeight:700,color:!form.isGstRegistered?"var(--acc)":"var(--muted)"}}>Non-GST</span></button>
          <button className="btn" style={{flex:1,padding:"12px",flexDirection:"column",gap:5,background:form.isGstRegistered?"var(--acc-bg)":"var(--bg3)",border:`1.5px solid ${form.isGstRegistered?"var(--acc-border)":"var(--border2)"}`,borderRadius:11}} onClick={()=>sf({isGstRegistered:true})}><span style={{fontSize:20}}>🏷</span><span style={{fontSize:11,fontWeight:700,color:form.isGstRegistered?"var(--acc)":"var(--muted)"}}>GST Registered</span></button>
        </div>
      </div>
      <div className="card" style={{padding:20,marginBottom:16}}>
        <div className="out" style={{fontWeight:700,fontSize:13,marginBottom:14}}>Invoice Color Theme</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {ACCENTS.map(a=>(
            <button key={a.id} onClick={()=>sf({accentId:a.id})} className="btn" style={{flexDirection:"column",gap:5,padding:"10px 14px",background:form.accentId===a.id?"var(--bg4)":"var(--bg3)",border:`2px solid ${form.accentId===a.id?a.hex:"var(--border2)"}`,borderRadius:11,minWidth:64}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:`linear-gradient(135deg,${a.hex},${a.dark})`,boxShadow:`0 0 12px ${a.hex}60`}}/>
              <span style={{fontSize:10,fontWeight:600,color:form.accentId===a.id?a.hex:"var(--muted)"}}>{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── ASK CA ───────────────────────────────────────────────────
const AskCA = ({business}) => {
  return(
    <div className="fi" style={{maxWidth:680}}>
      <div className="out page-title" style={{fontSize:"1.4rem",fontWeight:800,marginBottom:20}}>🎓 Ask a CA</div>
      <Empty icon="🤖" title="AI Chartered Accountant" sub="Connect your Claude API key to start chatting about GST, taxes, and compliance."/>
    </div>
  );
};

// ─── ONBOARDING ───────────────────────────────────────────────
const Onboarding = ({onComplete}) => {
  const [step,setStep]=useState(0);
  const [form,setForm]=useState({name:"",phone:"",accentId:"amber",type:"shop",isGstRegistered:false,gstin:"",bank:{upi:""}});
  const sf=f=>setForm(p=>({...p,...f}));
  const next=()=>setStep(s=>s+1);
  const finish=()=>onComplete(form);
  const accentHex=ACCENTS.find(a=>a.id===form.accentId)?.hex||"#F5A623";
  return(
    <div style={{minHeight:"100vh",background:"#0D1117",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{CSS+` :root{--acc:${accentHex};--acc2:${ACCENTS.find(a=>a.id===form.accentId)?.dark||"#C17D0E"};--acc-bg:${accentHex}14;--acc-border:${accentHex}38;}`}</style>
      <div style={{width:"100%",maxWidth:480}}>
        <div className="card slide-up" style={{padding:28,borderRadius:18}}>
          <div className="out" style={{fontSize:20,fontWeight:900,marginBottom:5}}>Welcome to BillBharat! 🎉</div>
          <div style={{fontSize:12.5,color:"var(--muted)",marginBottom:22}}>Let's set up your business in 2 minutes</div>
          
          {step===0&&<>
            <div style={{marginBottom:14}}><label className="lbl">Business Name *</label><input className="inp" value={form.name} onChange={e=>sf({name:e.target.value})} placeholder="e.g. Sharma General Store" autoFocus style={{fontSize:16,padding:"12px 14px"}}/></div>
            <div style={{marginBottom:14}}><label className="lbl">Phone Number</label><input className="inp" value={form.phone} onChange={e=>sf({phone:e.target.value})} placeholder="9876543210"/></div>
            <button className="btn btn-p" style={{width:"100%",padding:"13px"}} onClick={next} disabled={!form.name.trim()}>Continue →</button>
          </>}
          {step===1&&<>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
              {[{gst:false,icon:"✅",title:"No GST (below ₹20L)",sub:"Simple billing · No tax forms needed"},{gst:true,icon:"🏷",title:"GST Registered",sub:"Tax invoices · GSTR-1 filing required"}].map(({gst,icon,title,sub})=>(
                <button key={title} className="btn" onClick={()=>sf({isGstRegistered:gst})} style={{flexDirection:"column",gap:5,padding:"16px",background:form.isGstRegistered===gst?"var(--acc-bg)":"var(--bg3)",border:`1.5px solid ${form.isGstRegistered===gst?"var(--acc-border)":"var(--border2)"}`,borderRadius:12,alignItems:"flex-start",textAlign:"left"}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:20}}>{icon}</span><span style={{fontWeight:700,fontSize:13.5,color:form.isGstRegistered===gst?"var(--acc)":"var(--text)"}}>{title}</span></div>
                  <span style={{fontSize:11,color:"var(--muted)",paddingLeft:29}}>{sub}</span>
                </button>
              ))}
            </div>
            <button className="btn btn-p" style={{width:"100%",padding:"13px",fontSize:15}} onClick={finish}>🚀 Start Billing!</button>
          </>}
        </div>
      </div>
    </div>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────
export default function App() {
  const [invoices, setInvs]   = useState(()=>LS.get("invoices",null)||seedInvoices());
  const [customers,setCusts]  = useState(()=>LS.get("customers",DEMO_CUSTS));
  const [items,    setItems]  = useState(()=>LS.get("items",DEMO_ITEMS));
  const [expenses, setExp]    = useState(()=>LS.get("expenses",DEMO_EXP));
  const [business, setBiz]    = useState(()=>LS.get("biz",null));
  const [onboarded,setOnboarded]=useState(()=>!!LS.get("biz",null));
  const [page,     setPage]   = useState("dashboard");
  const [newInv,   setNewInv] = useState(false);
  const [editInv,  setEditInv]= useState(null);
  const [toast,    setToast]  = useState(null);
  const [mobOpen,  setMobOpen]= useState(false);
  const [lightMode,setLight]  = useState(false);  // false = classic (default), true = dark

  useEffect(()=>{
    if(lightMode) document.body.classList.add("dark-mode");
    else document.body.classList.remove("dark-mode");
  },[lightMode]);

  useEffect(()=>{if(invoices)LS.set("invoices",invoices);},[invoices]);
  useEffect(()=>{LS.set("customers",customers);},[customers]);
  useEffect(()=>{LS.set("items",items);},[items]);
  useEffect(()=>{LS.set("expenses",expenses);},[expenses]);
  useEffect(()=>{if(business)LS.set("biz",business);},[business]);

  const showToast=useCallback((msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),2800);},[]);

  const saveInv=useCallback(inv=>{
    setBiz(b=>({...b,invoiceCounter:(b?.invoiceCounter||1001)+1}));
    setInvs(p=>{const ex=p.find(i=>i.id===inv.id);return ex?p.map(i=>i.id===inv.id?inv:i):[inv,...p];});
    showToast(`${DOC_TYPES.find(d=>d.id===inv.type)?.label||"Bill"} saved!`);
    setNewInv(false);setEditInv(null);
  },[showToast]);

  const autoRemind=useCallback(()=>{
    showToast(`Reminder opened on WhatsApp`);
  },[showToast]);

  const delInv  =useCallback(id=>{if(!confirm("Delete this invoice?"))return;setInvs(p=>p.filter(i=>i.id!==id));showToast("Deleted");},[showToast]);
  const payInv  =useCallback((id,d)=>{setInvs(p=>p.map(i=>i.id===id?{...i,...d}:i));showToast("Payment recorded!");},[showToast]);
  const saveCust=useCallback(c=>{setCusts(p=>{const ex=p.find(i=>i.id===c.id);return ex?p.map(i=>i.id===c.id?c:i):[c,...p];});showToast("Customer saved!");},[showToast]);
  const delCust =useCallback(id=>{setCusts(p=>p.filter(c=>c.id!==id));showToast("Deleted");},[showToast]);
  const saveItem=useCallback(item=>{setItems(p=>{const ex=p.find(i=>i.id===item.id);return ex?p.map(i=>i.id===item.id?item:i):[item,...p];});showToast("Item saved!");},[showToast]);
  const delItem =useCallback(id=>{setItems(p=>p.filter(i=>i.id!==id));showToast("Deleted");},[showToast]);
  const saveExp =useCallback(exp=>{setExp(p=>{const ex=p.find(i=>i.id===exp.id);return ex?p.map(i=>i.id===exp.id?exp:i):[exp,...p];});showToast("Expense saved!");},[showToast]);
  const delExp  =useCallback(id=>{setExp(p=>p.filter(i=>i.id!==id));showToast("Deleted");},[showToast]);

  if(!onboarded) return <Onboarding onComplete={biz=>{const full={...DEMO_BIZ,...biz};setBiz(full);setOnboarded(true);LS.set("biz",full);}}/>;

  const isGst=business?.isGstRegistered;
  const overdueN=invoices.filter(i=>i.status==="overdue").length;
  const lowStockN=items.filter(i=>i.type==="product"&&i.stock<=i.lowStock).length;
  const accentObj=ACCENTS.find(a=>a.id===(business?.accentId||"amber"))||ACCENTS[0];

  const navItems=[
    {id:"dashboard",icon:"⬡",   l:"Dashboard"},
    {id:"invoices", icon:"📄",   l:"Documents",  badge:overdueN>0?overdueN:null},
    {id:"customers",icon:"👥",   l:"Customers"},
    {id:"items",    icon:"📦",   l:"Items",       badge:lowStockN>0?lowStockN:null,badgeColor:"#F0B429"},
    {id:"expenses", icon:"💸",   l:"Expenses"},
    {id:"calculator",icon:"🧮",  l:"GST & Scan"},
    {id:"reports",  icon:"📊",   l:"Reports"},
    {id:"askca",    icon:"🎓",   l:"Ask a CA"},
    {id:"settings", icon:"⚙️",  l:"Settings"},
  ];

  const navTo=id=>{setPage(id);setMobOpen(false);};

  return(
    <>
      <style>{`${CSS} :root{--acc:${accentObj.hex};--acc2:${accentObj.dark};--acc-bg:${accentObj.hex}14;--acc-border:${accentObj.hex}38;--acc-bg2:${accentObj.hex}0a;}`}</style>
      {toast&&<Toast msg={toast.msg} type={toast.type}/>}

      <div className={`mob-overlay ${mobOpen?"visible":""}`} onClick={()=>setMobOpen(false)}/>

      <header className="mob-header no-print">
        <button className={`hamburger ${mobOpen?"open":""}`} onClick={()=>setMobOpen(o=>!o)}><span/><span/><span/></button>
        <div style={{display:"flex",alignItems:"center",gap:7,flex:1}}>
          <div style={{width:26,height:26,borderRadius:7,background:`linear-gradient(135deg,${accentObj.hex},${accentObj.dark})`,display:"grid",placeItems:"center",fontSize:13,boxShadow:`0 0 12px ${accentObj.hex}40`,fontWeight:800,color:"#fff"}}>₹</div>
          <span className="out" style={{fontSize:14,fontWeight:800,color:"#fff"}}>BillBharat</span>
        </div>
        <button className="btn btn-ghost btn-xs" onClick={()=>setLight(l=>!l)} style={{fontSize:16,padding:"5px 8px",background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.15)",color:"#fff"}}>{lightMode?"☀️":"🌙"}</button>
        <button className="btn btn-p btn-sm" onClick={()=>setNewInv(true)}>+ New</button>
      </header>

      <div className="app-wrap">
        <aside className={`sidebar no-print ${mobOpen?"mob-open":""}`}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",marginBottom:16}}>
            <div style={{width:30,height:30,borderRadius:9,background:`linear-gradient(135deg,${accentObj.hex},${accentObj.dark})`,display:"grid",placeItems:"center",fontSize:15,flexShrink:0,boxShadow:`0 0 16px ${accentObj.hex}40`}}>₹</div>
            <span className="out sidebar-logo-text" style={{fontSize:14,fontWeight:800,color:"#fff"}}>BillBharat</span>
          </div>
          <button className="btn btn-p sidebar-new-btn" style={{width:"100%",marginBottom:10,padding:"9px 10px",fontSize:13}} onClick={()=>{setNewInv(true);setMobOpen(false);}}>
            <span>+</span><span className="sidebar-new-btn-text">New {isGst?"Invoice":"Bill"}</span>
          </button>
          <nav style={{flex:1,display:"flex",flexDirection:"column",gap:1}}>
            {navItems.map(item=>(
              <button key={item.id} className={`ni ${page===item.id?"active":""}`} onClick={()=>navTo(item.id)}>
                <div className="ni-dot"/>
                <span className="ni-icon" style={{fontSize:15}}>{item.icon}</span>
                <span className="ni-label" style={{flex:1, textAlign:"left"}}>{item.l}</span>
                {item.badge&&<span style={{background:item.badgeColor||"var(--red)",color:item.badgeColor?"#000":"#fff",borderRadius:"50%",width:17,height:17,display:"grid",placeItems:"center",fontSize:9,fontWeight:700,flexShrink:0}}>{item.badge}</span>}
              </button>
            ))}
          </nav>
          <div style={{marginTop:8,padding:"6px 2px",borderTop:"1px solid var(--border2)"}}>
            <button className="ni" onClick={()=>setLight(l=>!l)} style={{justifyContent:"center"}}>
              <span className="ni-icon" style={{fontSize:16}}>{lightMode?"☀️":"🌙"}</span>
              <span className="ni-label" style={{flex:1,textAlign:"left"}}>{lightMode?"Classic Mode":"Dark Mode"}</span>
            </button>
          </div>
        </aside>

        <main className="main-content">
          {page==="dashboard"  &&<Dashboard invoices={invoices} customers={customers} items={items} expenses={expenses} business={business} onNew={()=>setNewInv(true)} setPage={setPage} onAutoRemind={autoRemind}/>}
          {page==="invoices"   &&<InvoicesList invoices={invoices} onNew={()=>setNewInv(true)} onEdit={inv=>{setEditInv(inv);setNewInv(true);}} onDelete={delInv} onPay={payInv} business={business}/>}
          {page==="customers"  &&<Customers customers={customers} invoices={invoices} business={business} onSave={saveCust} onDelete={delCust}/>}
          {page==="items"      &&<Items items={items} business={business} onSave={saveItem} onDelete={delItem}/>}
          {page==="expenses"   &&<Expenses expenses={expenses} onSave={saveExp} onDelete={delExp}/>}
          {page==="calculator" &&<GstCalculator onSaveExpense={saveExp} expenses={expenses}/>}
          {page==="reports"    &&<Reports invoices={invoices} expenses={expenses} business={business}/>}
          {page==="askca"      &&<AskCA business={business}/>}
          {page==="settings"   &&<Settings business={business} onSave={b=>{setBiz(b);showToast("Settings saved! ✓");}}/>}
        </main>
      </div>

      {newInv&&<InvoiceModal inv={editInv} customers={customers} items={items} business={business} onUpdateBiz={b=>{setBiz(b); LS.set("biz",b);}} onSave={saveInv} onClose={()=>{setNewInv(false);setEditInv(null);}}/>}
    </>
  );
}
