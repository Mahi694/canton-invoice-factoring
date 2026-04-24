import React, { useState, useMemo } from 'react';
import { DamlLedger, useParty, useStreamQueries } from '@c7/react';
import { UnfundedInvoice, InvoiceBid, FundedInvoice } from '@daml.js/canton-invoice-factoring-0.1.0/lib/Factoring/Invoice';
import { createUnfundedInvoice, placeBid, acceptBid } from './factoringService';
import { InvoiceCard } from './InvoiceCard';
import './App.css';

// In a real app, these would be dynamically allocated or come from a user management system.
const PARTIES = {
  "PlatformOperator": "PlatformOperator::12202b7f35b452f1057e62455c165083c936b81e13e0e75e4695d5180e77d0cf8a3c",
  "Supplier": "Supplier::12202b7f35b452f1057e62455c165083c936b81e13e0e75e4695d5180e77d0cf8a3c",
  "Buyer": "Buyer::12202b7f35b452f1057e62455c165083c936b81e13e0e75e4695d5180e77d0cf8a3c",
  "Factor1": "Factor1::12202b7f35b452f1057e62455c165083c936b81e13e0e75e4695d5180e77d0cf8a3c",
  "Factor2": "Factor2::12202b7f35b452f1057e62455c165083c936b81e13e0e75e4695d5180e77d0cf8a3c",
};

// In a real app, the token would be acquired from an OAuth flow.
// For sandbox, we can generate these tokens.
// Example: daml json-api --ledger-host localhost --ledger-port 6865 --access-token-file /dev/null --port 7575
// The JWT token is printed to the console on startup.
const DUMMY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL2RhbWwuY29tL2xlZGdlci1hcGkiOnsibGVkZ2VySWQiOiJzYW5kYm94IiwicGFydGljaXBhbnRJZCI6InB1YmxpYyIsImFwcGxpY2F0aW9uSWQiOiJodHRwLXNlcnZpY2UifSwicmVhZEFzIjpbIlN1cHBsaWVyIiwiQnV5ZXIiLCJGYWN0b3IxIiwiRmFjdG9yMiIsIlBsYXRmb3JtT3BlcmF0b3IiXSwiYWN0QXMiOlsiU3VwcGxpZXIiLCJCdXllciIsIkZhY3RvcjEiLCJGYWN0b3IyIiwiUGxhdGZvcm1T3BlcmF0b3IiXX19.eRnh2a12L4sN8bYp3wR7O2unxMTCKRLPIh5lAUn9cnQ";

type Role = keyof typeof PARTIES;
type Credentials = { partyId: string, token: string, role: Role };

const App: React.FC = () => {
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const handleLogin = (role: Role) => {
    setCredentials({ partyId: PARTIES[role], token: DUMMY_TOKEN, role });
  };

  if (!credentials) {
    return (
      <div className="login-container">
        <h1>Canton Invoice Factoring</h1>
        <h2>Select a Role to Log In</h2>
        <div className="login-buttons">
          {(Object.keys(PARTIES) as Role[]).map(role => (
            <button key={role} onClick={() => handleLogin(role)}>
              Login as {role}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DamlLedger token={credentials.token} party={credentials.partyId}>
      <Marketplace credentials={credentials} onLogout={() => setCredentials(null)} />
    </DamlLedger>
  );
};


type MarketplaceProps = {
  credentials: Credentials;
  onLogout: () => void;
};

const Marketplace: React.FC<MarketplaceProps> = ({ credentials, onLogout }) => {
  const party = useParty();
  const { role } = credentials;

  const unfundedQuery = useStreamQueries(UnfundedInvoice);
  const bidsQuery = useStreamQueries(InvoiceBid);
  const fundedQuery = useStreamQueries(FundedInvoice);

  const myUnfundedInvoices = useMemo(() =>
    unfundedQuery.contracts.filter(c => c.payload.supplier === party),
    [unfundedQuery.contracts, party]
  );

  const myBidsOnMyInvoices = useMemo(() =>
    bidsQuery.contracts.filter(bid => myUnfundedInvoices.some(inv => inv.contractId === bid.payload.invoiceCid)),
    [bidsQuery.contracts, myUnfundedInvoices]
  );

  const marketplaceInvoices = useMemo(() =>
    unfundedQuery.contracts.filter(c => c.payload.supplier !== party),
    [unfundedQuery.contracts, party]
  );

  const myFactoredInvoices = useMemo(() =>
    fundedQuery.contracts.filter(c => c.payload.invoice.supplier === party),
    [fundedQuery.contracts, party]
  );

  const myInvestments = useMemo(() =>
    fundedQuery.contracts.filter(c => c.payload.factor === party),
    [fundedQuery.contracts, party]
  );

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const invoiceId = formData.get('invoiceId') as string;
    const amount = formData.get('amount') as string;
    const dueDate = formData.get('dueDate') as string;

    if (!invoiceId || !amount || !dueDate) {
      alert("Please fill all fields");
      return;
    }

    try {
      await createUnfundedInvoice(
        party,
        DUMMY_TOKEN,
        PARTIES.Buyer,
        invoiceId,
        amount,
        dueDate
      );
      alert("Invoice created successfully!");
      e.currentTarget.reset();
    } catch (error) {
      console.error("Failed to create invoice:", error);
      alert("Failed to create invoice.");
    }
  };

  const handlePlaceBid = async (invoiceCid: string, advanceRate: string) => {
    try {
      await placeBid(party, DUMMY_TOKEN, invoiceCid, advanceRate);
      alert(`Bid placed successfully on invoice ${invoiceCid}`);
    } catch (error) {
      console.error("Failed to place bid:", error);
      alert("Failed to place bid.");
    }
  };

  const handleAcceptBid = async (bidCid: string) => {
    try {
      await acceptBid(party, DUMMY_TOKEN, bidCid);
      alert(`Bid accepted successfully!`);
    } catch (error) {
      console.error("Failed to accept bid:", error);
      alert("Failed to accept bid.");
    }
  };

  const renderSupplierView = () => (
    <>
      <div className="section">
        <h2>Create New Invoice</h2>
        <form className="invoice-form" onSubmit={handleCreateInvoice}>
          <input type="text" name="invoiceId" placeholder="Invoice ID (e.g., INV-2024-001)" required />
          <input type="number" name="amount" placeholder="Invoice Amount" step="0.01" required />
          <input type="date" name="dueDate" placeholder="Due Date" required />
          <button type="submit">Create Invoice</button>
        </form>
      </div>

      <div className="section">
        <h2>My Unfunded Invoices</h2>
        <div className="card-container">
          {myUnfundedInvoices.length === 0 ? <p>No unfunded invoices.</p> :
            myUnfundedInvoices.map(c => (
              <InvoiceCard
                key={c.contractId}
                invoice={c.payload}
                cid={c.contractId}
                role={role}
                bids={myBidsOnMyInvoices.filter(b => b.payload.invoiceCid === c.contractId)}
                onAcceptBid={handleAcceptBid}
              />
            ))
          }
        </div>
      </div>

      <div className="section">
        <h2>My Factored Invoices</h2>
        <div className="card-container">
          {myFactoredInvoices.length === 0 ? <p>No factored invoices.</p> :
            myFactoredInvoices.map(c => (
              <InvoiceCard
                key={c.contractId}
                invoice={c.payload.invoice}
                cid={c.contractId}
                role={role}
                fundedInfo={{ factor: c.payload.factor, advanceAmount: c.payload.advanceAmount }}
              />
            ))
          }
        </div>
      </div>
    </>
  );

  const renderFactorView = () => (
    <>
      <div className="section">
        <h2>Marketplace - Invoices Available for Factoring</h2>
        <div className="card-container">
          {marketplaceInvoices.length === 0 ? <p>No invoices available in the marketplace.</p> :
            marketplaceInvoices.map(c => (
              <InvoiceCard
                key={c.contractId}
                invoice={c.payload}
                cid={c.contractId}
                role={role}
                onPlaceBid={handlePlaceBid}
              />
            ))
          }
        </div>
      </div>
      <div className="section">
        <h2>My Investments (Factored Invoices)</h2>
        <div className="card-container">
          {myInvestments.length === 0 ? <p>You have not factored any invoices yet.</p> :
            myInvestments.map(c => (
              <InvoiceCard
                key={c.contractId}
                invoice={c.payload.invoice}
                cid={c.contractId}
                role={role}
                fundedInfo={{ factor: c.payload.factor, advanceAmount: c.payload.advanceAmount }}
              />
            ))
          }
        </div>
      </div>
    </>
  );

  const renderBuyerView = () => (
    <>
      <div className="section">
        <h2>Invoices to be Paid</h2>
        <p>Buyer functionality (e.g., viewing and repaying invoices) would be built out here.</p>
        {/* Further implementation would show invoices where this party is the buyer */}
      </div>
    </>
  );


  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Invoice Factoring Marketplace</h1>
        <div className="user-info">
          <span>Logged in as: <strong>{role}</strong> ({party})</span>
          <button onClick={onLogout}>Logout</button>
        </div>
      </header>
      <main className="main-content">
        {(unfundedQuery.loading || bidsQuery.loading || fundedQuery.loading) && <div className="loading">Loading contracts...</div>}
        {role === 'Supplier' && renderSupplierView()}
        {role === 'Factor1' && renderFactorView()}
        {role === 'Factor2' && renderFactorView()}
        {role === 'Buyer' && renderBuyerView()}
      </main>
    </div>
  );
};


export default App;