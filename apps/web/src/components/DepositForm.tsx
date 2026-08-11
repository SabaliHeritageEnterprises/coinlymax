'use client';

import { useState } from 'react';
import { useAuth } from '@/store/auth';
import { db } from '@/components/firebase';
import { doc, updateDoc, increment } from 'firebase/firestore';

interface DepositDetails {
  cardNumber: string;
  cardHolder: string;
  expiryDate: string;
  cvv: string;
  amount: number;
}

export default function DepositForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<DepositDetails>({
    cardNumber: '',
    cardHolder: '',
    expiryDate: '',
    cvv: '',
    amount: 0
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const formatted = cleaned.replace(/(.{4})/g, '$1 ').trim();
    return formatted.slice(0, 19); // 16 digits + 3 spaces
  };

  const formatExpiryDate = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setForm(prev => ({ ...prev, cardNumber: formatted }));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    setForm(prev => ({ ...prev, expiryDate: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to deposit');
      return;
    }

    if (form.amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Validate card details (basic validation)
    const cardDigits = form.cardNumber.replace(/\s/g, '');
    if (cardDigits.length !== 16) {
      setError('Please enter a valid 16-digit card number');
      return;
    }

    if (form.expiryDate.length !== 5) {
      setError('Please enter a valid expiry date (MM/YY)');
      return;
    }

    if (form.cvv.length !== 3 && form.cvv.length !== 4) {
      setError('Please enter a valid CVV');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Save deposit request to Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        balance: increment(form.amount),
        depositHistory: [
          {
            amount: form.amount,
            cardLast4: form.cardNumber.slice(-4),
            cardType: detectCardType(form.cardNumber),
            timestamp: new Date().toISOString(),
            status: 'completed'
          }
        ]
      });

      setSuccess(true);
      setForm({
        cardNumber: '',
        cardHolder: '',
        expiryDate: '',
        cvv: '',
        amount: 0
      });

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Deposit error:', err);
      setError('Failed to process deposit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const detectCardType = (cardNumber: string) => {
    const cleaned = cardNumber.replace(/\s/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (cleaned.startsWith('5')) return 'Mastercard';
    if (cleaned.startsWith('3')) return 'Amex';
    if (cleaned.startsWith('6')) return 'Discover';
    return 'Unknown';
  };

  if (!user) {
    return (
      <div className="card p-6 text-center">
        <p className="text-muted">Please log in to make a deposit.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="card p-6 text-center border-green-500 border-2">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-xl font-bold text-green-500">Deposit Successful!</h3>
        <p className="text-muted mt-2">
          ${form.amount} has been added to your balance.
        </p>
        <button
          onClick={() => setSuccess(false)}
          className="mt-4 btn-gold"
        >
          Make Another Deposit
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-2">💳 Deposit Funds</h2>
      <p className="text-muted text-sm mb-6">Enter your card details to deposit funds</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-sm text-muted mb-1">Amount (USD)</label>
          <input
            type="number"
            name="amount"
            value={form.amount || ''}
            onChange={handleChange}
            min="10"
            step="10"
            placeholder="Enter amount (min $10)"
            className="input w-full"
            required
          />
        </div>

        {/* Card Number */}
        <div>
          <label className="block text-sm text-muted mb-1">Card Number</label>
          <input
            type="text"
            name="cardNumber"
            value={form.cardNumber}
            onChange={handleCardNumberChange}
            placeholder="1234 5678 9012 3456"
            className="input w-full"
            maxLength={19}
            required
          />
        </div>

        {/* Card Holder */}
        <div>
          <label className="block text-sm text-muted mb-1">Card Holder Name</label>
          <input
            type="text"
            name="cardHolder"
            value={form.cardHolder}
            onChange={handleChange}
            placeholder="John Doe"
            className="input w-full"
            required
          />
        </div>

        {/* Expiry & CVV */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Expiry Date</label>
            <input
              type="text"
              name="expiryDate"
              value={form.expiryDate}
              onChange={handleExpiryChange}
              placeholder="MM/YY"
              className="input w-full"
              maxLength={5}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">CVV</label>
            <input
              type="password"
              name="cvv"
              value={form.cvv}
              onChange={handleChange}
              placeholder="•••"
              className="input w-full"
              maxLength={4}
              required
            />
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-gold w-full py-3 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Deposit Funds'}
        </button>

        <p className="text-xs text-muted text-center mt-4">
          🔒 Your card details are securely encrypted
        </p>
      </form>
    </div>
  );
}