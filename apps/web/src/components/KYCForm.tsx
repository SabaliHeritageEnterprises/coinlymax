'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/store/auth';
import { db } from '@/components/firebase';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Upload, Check, X, AlertCircle, User, Mail, Calendar, MapPin, FileText } from 'lucide-react';

interface KYCData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  idType: 'passport' | 'id_card' | 'drivers_license';
  idNumber: string;
  status: 'pending' | 'verified' | 'rejected' | 'none';
  submittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export default function KYCForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [kycData, setKycData] = useState<KYCData | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    nationality: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    idType: 'passport' as const,
    idNumber: '',
  });
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load existing KYC data
  useEffect(() => {
    if (!user) return;
    const loadKYC = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.kyc) {
            setKycData(data.kyc);
            // Pre-fill form with existing data
            setForm({
              firstName: data.kyc.firstName || '',
              lastName: data.kyc.lastName || '',
              dateOfBirth: data.kyc.dateOfBirth || '',
              nationality: data.kyc.nationality || '',
              address: data.kyc.address || '',
              city: data.kyc.city || '',
              country: data.kyc.country || '',
              postalCode: data.kyc.postalCode || '',
              idType: data.kyc.idType || 'passport',
              idNumber: data.kyc.idNumber || '',
            });
          }
        }
      } catch (err) {
        console.error('Error loading KYC data:', err);
      }
    };
    loadKYC();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('Please log in to submit KYC');
      return;
    }

    // Validate form
    if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.nationality) {
      setError('Please fill in all required fields');
      return;
    }

    if (!idFront || !selfie) {
      setError('Please upload ID front and selfie');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      // In production, upload files to Firebase Storage
      // For now, we'll store the KYC data with file references

      const kycData: KYCData = {
        ...form,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        kyc: kycData,
        kycStatus: 'pending',
        kycSubmittedAt: new Date().toISOString(),
      });

      setKycData(kycData);
      setSuccess('KYC submitted successfully! Waiting for admin verification.');
      
      // Reset form
      setIdFront(null);
      setIdBack(null);
      setSelfie(null);

    } catch (err) {
      console.error('KYC submission error:', err);
      setError('Failed to submit KYC. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatus = () => {
    if (!kycData || kycData.status === 'none') {
      return (
        <div className="text-muted text-sm">
          You haven't submitted KYC verification yet.
        </div>
      );
    }

    switch (kycData.status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-yellow-500">
            <AlertCircle size={20} />
            <span>Pending Verification</span>
            <span className="text-sm text-muted">- Your documents are being reviewed</span>
          </div>
        );
      case 'verified':
        return (
          <div className="flex items-center gap-2 text-green-500">
            <Check size={20} />
            <span>Verified</span>
            <span className="text-sm text-muted">- Your identity is confirmed</span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-2 text-red-500">
            <X size={20} />
            <span>Rejected</span>
            <span className="text-sm text-muted">- {kycData.rejectionReason || 'Please resubmit'}</span>
          </div>
        );
      default:
        return null;
    }
  };

  if (kycData?.status === 'verified') {
    return (
      <div className="card p-6 border-green-500 border-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-green-500/20 p-3 rounded-full">
            <Check className="text-green-500" size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-green-500">KYC Verified</h3>
            <p className="text-muted text-sm">Your identity has been verified</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted">Name</p>
            <p className="font-medium">{kycData.firstName} {kycData.lastName}</p>
          </div>
          <div>
            <p className="text-muted">ID Type</p>
            <p className="font-medium capitalize">{kycData.idType.replace('_', ' ')}</p>
          </div>
          <div>
            <p className="text-muted">Verified At</p>
            <p className="font-medium">{kycData.verifiedAt ? new Date(kycData.verifiedAt).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (kycData?.status === 'pending') {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-yellow-500/20 p-3 rounded-full">
            <AlertCircle className="text-yellow-500" size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-yellow-500">Pending Verification</h3>
            <p className="text-muted text-sm">Your KYC is being reviewed by our team</p>
          </div>
        </div>
        <p className="text-muted text-sm">We'll notify you once your verification is complete.</p>
      </div>
    );
  }

  if (kycData?.status === 'rejected') {
    return (
      <div className="space-y-4">
        <div className="card p-6 border-red-500 border-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-red-500/20 p-3 rounded-full">
              <X className="text-red-500" size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-red-500">KYC Rejected</h3>
              <p className="text-muted text-sm">Your submission was not approved</p>
            </div>
          </div>
          {kycData.rejectionReason && (
            <div className="bg-red-500/10 p-3 rounded-lg">
              <p className="text-sm text-red-400">Reason: {kycData.rejectionReason}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setKycData(null);
            setForm({
              firstName: '',
              lastName: '',
              dateOfBirth: '',
              nationality: '',
              address: '',
              city: '',
              country: '',
              postalCode: '',
              idType: 'passport',
              idNumber: '',
            });
          }}
          className="btn-gold"
        >
          Resubmit KYC
        </button>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-gold/20 p-3 rounded-full">
          <User className="text-gold" size={32} />
        </div>
        <div>
          <h3 className="text-xl font-bold">KYC Verification</h3>
          <p className="text-muted text-sm">Verify your identity to unlock full trading features</p>
        </div>
      </div>

      {renderStatus()}

      <form onSubmit={handleSubmit} className="space-y-4 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">First Name *</label>
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              className="input w-full"
              placeholder="John"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              className="input w-full"
              placeholder="Doe"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">Date of Birth *</label>
            <input
              type="date"
              name="dateOfBirth"
              value={form.dateOfBirth}
              onChange={handleChange}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Nationality *</label>
            <input
              type="text"
              name="nationality"
              value={form.nationality}
              onChange={handleChange}
              className="input w-full"
              placeholder="American"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1">Address *</label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleChange}
            className="input w-full"
            placeholder="123 Main Street"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">City *</label>
            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              className="input w-full"
              placeholder="New York"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Country *</label>
            <input
              type="text"
              name="country"
              value={form.country}
              onChange={handleChange}
              className="input w-full"
              placeholder="USA"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Postal Code</label>
            <input
              type="text"
              name="postalCode"
              value={form.postalCode}
              onChange={handleChange}
              className="input w-full"
              placeholder="10001"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1">ID Type *</label>
            <select
              name="idType"
              value={form.idType}
              onChange={handleChange}
              className="input w-full"
              required
            >
              <option value="passport">Passport</option>
              <option value="id_card">National ID Card</option>
              <option value="drivers_license">Driver's License</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">ID Number *</label>
            <input
              type="text"
              name="idNumber"
              value={form.idNumber}
              onChange={handleChange}
              className="input w-full"
              placeholder="Enter ID number"
              required
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="font-semibold mb-3">Upload Documents</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">ID Front *</label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-gold transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setIdFront)}
                  className="hidden"
                  id="idFront"
                  required={!kycData}
                />
                <label htmlFor="idFront" className="cursor-pointer block">
                  {idFront ? (
                    <div>
                      <Check className="mx-auto text-green-500" size={24} />
                      <p className="text-xs text-muted mt-1">{idFront.name}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="mx-auto text-muted" size={24} />
                      <p className="text-xs text-muted mt-1">Upload front</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">ID Back (Optional)</label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-gold transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setIdBack)}
                  className="hidden"
                  id="idBack"
                />
                <label htmlFor="idBack" className="cursor-pointer block">
                  {idBack ? (
                    <div>
                      <Check className="mx-auto text-green-500" size={24} />
                      <p className="text-xs text-muted mt-1">{idBack.name}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="mx-auto text-muted" size={24} />
                      <p className="text-xs text-muted mt-1">Upload back</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Selfie with ID *</label>
              <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-gold transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, setSelfie)}
                  className="hidden"
                  id="selfie"
                  required={!kycData}
                />
                <label htmlFor="selfie" className="cursor-pointer block">
                  {selfie ? (
                    <div>
                      <Check className="mx-auto text-green-500" size={24} />
                      <p className="text-xs text-muted mt-1">{selfie.name}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="mx-auto text-muted" size={24} />
                      <p className="text-xs text-muted mt-1">Upload selfie</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-500 text-sm bg-green-500/10 p-3 rounded-lg">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-gold w-full py-3 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit KYC'}
        </button>

        <p className="text-xs text-muted text-center">
          🔒 Your documents are encrypted and secure
        </p>
      </form>
    </div>
  );
}