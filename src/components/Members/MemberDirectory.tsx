import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { Modal, StatusBadge, SearchBar, EmptyState } from '../common';
import { useToast } from '../common/Toast';
import {
  Member,
  MemberType,
  MemberStatus,
  VerificationStatus,
  PaymentMethod,
  FineStatus,
} from '../../types';
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  getInitials,
} from '../../utils/helpers';
import { DEPARTMENTS, BORROW_LIMITS } from '../../utils/constants';
import {
  Users,
  UserPlus,
  Eye,
  Pencil,
  Camera,
  CameraOff,
  RefreshCw,
  Mail,
  Receipt,
  BookOpen,
  Clock,
  DollarSign,
  History,
} from 'lucide-react';

const MemberDirectory: React.FC = () => {
  const {
    state,
    registerMember,
    updateMember,
    verifyMember,
    rejectMember,
    getNextMemberID,
    payFine,
  } = useLibrary();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MemberType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'ALL'>('ALL');

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'profile' | 'borrows' | 'fines' | 'reservations' | 'emails' | 'deposits' | 'audit'>('profile');

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    department: DEPARTMENTS[0] || 'Computer Science',
    year: '1st Year',
    course: 'B.Tech',
    memberType: MemberType.STUDENT,
    profilePhoto: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup camera on unmount or modal close
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      showToast('Camera access denied or unavailable', 'error');
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFormData(prev => ({ ...prev, profilePhoto: dataUrl }));
      stopCamera();
      showToast('Photo captured', 'success');
    }
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return state.members.filter(m => {
      const matchesSearch =
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.department.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === 'ALL' || m.memberType === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [state.members, searchQuery, typeFilter, statusFilter]);

  const openRegisterModal = () => {
    setEditingMember(null);
    setFormData({
      id: getNextMemberID(),
      fullName: '',
      email: '',
      phone: '',
      address: '',
      department: DEPARTMENTS[0] || 'Computer Science',
      year: '1st Year',
      course: 'B.Tech',
      memberType: MemberType.STUDENT,
      profilePhoto: '',
    });
    setFormErrors({});
    setIsRegisterModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setFormData({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      address: member.address,
      department: member.department,
      year: member.year,
      course: member.course,
      memberType: member.memberType,
      profilePhoto: member.profilePhoto,
    });
    setFormErrors({});
    setIsRegisterModalOpen(true);
  };

  const openDetailModal = (member: Member) => {
    setSelectedMember(member);
    setActiveDetailTab('profile');
    setIsRejecting(false);
    setRejectReason('');
    setIsDetailModalOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email';
    if (!formData.phone.trim()) errors.phone = 'Phone number is required';
    else if (!/^\d{10}$/.test(formData.phone.replace(/\s/g, ''))) errors.phone = 'Phone must be 10 digits';
    if (!formData.department.trim()) errors.department = 'Department is required';

    // Duplicate check
    const isDupEmail = state.members.some(
      m => m.email.toLowerCase() === formData.email.toLowerCase() && m.id !== (editingMember ? editingMember.id : '')
    );
    if (isDupEmail) errors.email = 'A member with this email already exists';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (editingMember) {
        const res = await updateMember(editingMember.id, formData);
        if (res.success) {
          showToast('Member profile updated successfully', 'success');
          setIsRegisterModalOpen(false);
        } else {
          showToast('Failed to update member', 'error');
        }
      } else {
        const res = await registerMember(formData);
        if (res.success) {
          showToast(`Member #${res.member?.id} registered! Confirmation email dispatched`, 'success');
          setIsRegisterModalOpen(false);
        } else {
          showToast(res.error || 'Failed to register member', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing request', 'error');
    }
  };

  const handleVerify = async (memberId: string) => {
    const res = await verifyMember(memberId);
    if (res.success) {
      showToast('Member verified & notified by email', 'success');
      if (selectedMember && selectedMember.id === memberId) {
        setSelectedMember(prev => prev ? { ...prev, verification: VerificationStatus.VERIFIED } : null);
      }
    }
  };

  const handleReject = async (memberId: string) => {
    if (!rejectReason.trim()) {
      showToast('Please state a reason for rejection', 'error');
      return;
    }
    const res = await rejectMember(memberId, rejectReason);
    if (res.success) {
      showToast('Member rejected & notification sent', 'info');
      setIsRejecting(false);
      if (selectedMember && selectedMember.id === memberId) {
        setSelectedMember(prev => prev ? { ...prev, verification: VerificationStatus.REJECTED } : null);
      }
    }
  };

  const handlePayFine = async (fineId: string) => {
    const res = await payFine(fineId, PaymentMethod.CASH);
    if (res.success) {
      showToast('Fine payment processed & receipt emailed', 'success');
    }
  };

  const renderAvatar = (member: Member, size = 'w-10 h-10', text = 'text-sm') => {
    if (member.profilePhoto) {
      return <img src={member.profilePhoto} alt={member.fullName} className={`${size} rounded-full object-cover shadow-sm`} />;
    }
    return (
      <div className={`${size} rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold ${text} shadow-sm`}>
        {getInitials(member.fullName)}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-600" />
            Member Directory
          </h1>
          <p className="text-sm text-gray-500">Manage university patrons, verification workflows, and borrowing profiles</p>
        </div>
        <button
          onClick={openRegisterModal}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition-all"
        >
          <UserPlus size={18} />
          Register New Member
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="w-full md:w-80">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search by name, ID, email, dept..." />
        </div>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Patron Types</option>
            <option value={MemberType.STUDENT}>Students</option>
            <option value={MemberType.FACULTY}>Faculty</option>
            <option value={MemberType.STAFF}>Staff</option>
            <option value={MemberType.EXTERNAL}>External</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value={MemberStatus.ACTIVE}>Active</option>
            <option value={MemberStatus.INACTIVE}>Inactive</option>
            <option value={MemberStatus.SUSPENDED}>Suspended</option>
            <option value={MemberStatus.BLOCKED}>Blocked</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Member</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">ID</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Department / Year</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Contact</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Type</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Verification</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500">Status</th>
                <th className="px-6 py-3.5 text-xs font-semibold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12">
                    <EmptyState icon={Users} title="No members found" description="Try adjusting your search criteria or register a new member." />
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {renderAvatar(m)}
                        <div>
                          <p className="font-semibold text-gray-900">{m.fullName}</p>
                          <p className="text-xs text-gray-400">Joined {formatDate(m.registrationDate)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-600">{m.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <p className="font-medium text-gray-800">{m.department}</p>
                      <p className="text-xs text-gray-400">{m.year} • {m.course}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <p>{m.email}</p>
                      <p className="text-xs text-gray-400">{m.phone}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{m.memberType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={m.verification} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetailModal(m)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => openEditModal(m)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit Profile"
                        >
                          <Pencil size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Registration & Edit Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          stopCamera();
          setIsRegisterModalOpen(false);
        }}
        title={editingMember ? `Edit Member #${editingMember.id}` : 'Register New University Member'}
        size="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-6 py-2">
          {/* Camera Section */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
              <Camera size={16} /> Member Profile Photo Capture
            </h4>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 bg-white overflow-hidden flex items-center justify-center relative">
                {formData.profilePhoto ? (
                  <img src={formData.profilePhoto} alt="Captured" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400 text-center px-1">No photo</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition"
                  >
                    <Camera size={14} /> Start Camera
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition"
                    >
                      <Camera size={14} /> Capture Frame
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition"
                    >
                      <CameraOff size={14} /> Close
                    </button>
                  </div>
                )}
                {formData.profilePhoto && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, profilePhoto: '' }))}
                    className="text-xs text-rose-600 hover:underline text-left"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {isCameraActive && (
              <div className="mt-3 relative aspect-video max-w-sm bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${formErrors.fullName ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-300 focus:ring-indigo-500'}`}
                placeholder="e.g. Rahul Sharma"
              />
              {formErrors.fullName && <p className="text-xs text-rose-500 mt-1">{formErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${formErrors.email ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-300 focus:ring-indigo-500'}`}
                placeholder="e.g. rahul@students.amrita.edu"
              />
              {formErrors.email && <p className="text-xs text-rose-500 mt-1">{formErrors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone Number (10 Digits) *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${formErrors.phone ? 'border-rose-500 focus:ring-rose-500' : 'border-gray-300 focus:ring-indigo-500'}`}
                placeholder="9876543210"
              />
              {formErrors.phone && <p className="text-xs text-rose-500 mt-1">{formErrors.phone}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Department *</label>
              <select
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Year / Position</label>
              <select
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Faculty">Faculty</option>
                <option value="Staff">Staff</option>
                <option value="N/A">N/A</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Course / Specialization</label>
              <input
                type="text"
                value={formData.course}
                onChange={e => setFormData({ ...formData, course: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. B.Tech CSE"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Member Type</label>
              <select
                value={formData.memberType}
                onChange={e => setFormData({ ...formData, memberType: e.target.value as MemberType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={MemberType.STUDENT}>Student (Limit: 5 books)</option>
                <option value={MemberType.FACULTY}>Faculty (Limit: 10 books)</option>
                <option value={MemberType.STAFF}>Staff (Limit: 5 books)</option>
                <option value={MemberType.EXTERNAL}>External Patron (Deposit: ₹500)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Assigned Member ID</label>
              <input
                type="text"
                value={editingMember ? editingMember.id : formData.id}
                disabled
                className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm font-mono text-gray-600 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Campus / Residential Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Hall of Residence / City Address..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setIsRegisterModalOpen(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              {editingMember ? 'Save Changes' : 'Confirm Registration'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Member Tracking Details Modal */}
      {selectedMember && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Member Profile #${selectedMember.id}`}
          size="xl"
        >
          <div className="space-y-6 py-2">
            {/* Header Card */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                {renderAvatar(selectedMember, 'w-16 h-16', 'text-xl')}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedMember.fullName}</h3>
                  <p className="text-sm text-gray-600">{selectedMember.department} • {selectedMember.year}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge status={selectedMember.verification} />
                    <StatusBadge status={selectedMember.status} />
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white border border-indigo-200 text-indigo-700">
                      {selectedMember.memberType}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification Actions */}
              {selectedMember.verification === VerificationStatus.PENDING && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(selectedMember.id)}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700"
                    >
                      Verify Account
                    </button>
                    <button
                      onClick={() => setIsRejecting(true)}
                      className="px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700"
                    >
                      Reject
                    </button>
                  </div>
                  {isRejecting && (
                    <div className="flex gap-1 mt-1">
                      <input
                        type="text"
                        placeholder="Reason for rejection..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                        className="px-2 py-1 text-xs border rounded w-44"
                      />
                      <button
                        onClick={() => handleReject(selectedMember.id)}
                        className="px-2 py-1 bg-rose-700 text-white text-xs rounded"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-2 border-b border-gray-200 pb-2 text-sm font-medium">
              <button
                onClick={() => setActiveDetailTab('profile')}
                className={`px-3 py-1.5 rounded-lg transition ${activeDetailTab === 'profile' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Profile & Limits
              </button>
              <button
                onClick={() => setActiveDetailTab('borrows')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeDetailTab === 'borrows' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <BookOpen size={14} /> Borrow History
              </button>
              <button
                onClick={() => setActiveDetailTab('fines')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeDetailTab === 'fines' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <DollarSign size={14} /> Fines & Payments
              </button>
              <button
                onClick={() => setActiveDetailTab('reservations')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeDetailTab === 'reservations' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Clock size={14} /> Holds
              </button>
              <button
                onClick={() => setActiveDetailTab('emails')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeDetailTab === 'emails' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Mail size={14} /> Email Log
              </button>
              {selectedMember.memberType === MemberType.EXTERNAL && (
                <button
                  onClick={() => setActiveDetailTab('deposits')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeDetailTab === 'deposits' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  <Receipt size={14} /> Deposits
                </button>
              )}
              <button
                onClick={() => setActiveDetailTab('audit')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${activeDetailTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <History size={14} /> Audit Trail
              </button>
            </div>

            {/* Tab Content */}
            {activeDetailTab === 'profile' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                  <p className="text-gray-500 text-xs uppercase font-semibold">Contact Info</p>
                  <p><strong className="text-gray-700">Email:</strong> {selectedMember.email}</p>
                  <p><strong className="text-gray-700">Phone:</strong> {selectedMember.phone}</p>
                  <p><strong className="text-gray-700">Address:</strong> {selectedMember.address || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                  <p className="text-gray-500 text-xs uppercase font-semibold">Circulation Limits</p>
                  <p><strong className="text-gray-700">Borrow Limit:</strong> {selectedMember.borrowLimit} Books</p>
                  <p><strong className="text-gray-700">Active Borrowed:</strong> {selectedMember.currentBorrowed} Books</p>
                  <p><strong className="text-gray-700">Registered:</strong> {formatDate(selectedMember.registrationDate)}</p>
                </div>
              </div>
            )}

            {activeDetailTab === 'borrows' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Txn ID</th>
                      <th className="px-4 py-2 font-semibold">Book Title</th>
                      <th className="px-4 py-2 font-semibold">Issue Date</th>
                      <th className="px-4 py-2 font-semibold">Due Date</th>
                      <th className="px-4 py-2 font-semibold">Return Date</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.transactions.filter(t => t.memberId === selectedMember.id).map(t => (
                      <tr key={t.id}>
                        <td className="px-4 py-2 font-mono">{t.id}</td>
                        <td className="px-4 py-2 font-medium">{t.bookTitle}</td>
                        <td className="px-4 py-2">{formatDate(t.issueDate)}</td>
                        <td className="px-4 py-2">{formatDate(t.dueDate)}</td>
                        <td className="px-4 py-2">{t.returnDate ? formatDate(t.returnDate) : '-'}</td>
                        <td className="px-4 py-2"><StatusBadge status={t.status} size="sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeDetailTab === 'fines' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Fine ID</th>
                        <th className="px-4 py-2 font-semibold">Book</th>
                        <th className="px-4 py-2 font-semibold">Amount</th>
                        <th className="px-4 py-2 font-semibold">Days Overdue</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                        <th className="px-4 py-2 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {state.fines.filter(f => f.memberId === selectedMember.id).map(f => (
                        <tr key={f.id}>
                          <td className="px-4 py-2 font-mono">{f.id}</td>
                          <td className="px-4 py-2">{f.bookTitle}</td>
                          <td className="px-4 py-2 font-bold">{formatCurrency(f.amount)}</td>
                          <td className="px-4 py-2">{f.daysOverdue} days</td>
                          <td className="px-4 py-2"><StatusBadge status={f.status} size="sm" /></td>
                          <td className="px-4 py-2">
                            {f.status === FineStatus.PENDING && (
                              <button
                                onClick={() => handlePayFine(f.id)}
                                className="px-2 py-1 bg-emerald-600 text-white rounded text-xs"
                              >
                                Pay Now
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeDetailTab === 'reservations' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Hold ID</th>
                      <th className="px-4 py-2 font-semibold">Book Title</th>
                      <th className="px-4 py-2 font-semibold">Position</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Reserved At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.reservations.filter(r => r.memberId === selectedMember.id).map(r => (
                      <tr key={r.id}>
                        <td className="px-4 py-2 font-mono">{r.id}</td>
                        <td className="px-4 py-2 font-medium">{r.bookTitle}</td>
                        <td className="px-4 py-2 font-bold text-indigo-600">#{r.position}</td>
                        <td className="px-4 py-2"><StatusBadge status={r.status} size="sm" /></td>
                        <td className="px-4 py-2">{formatDateTime(r.reservedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeDetailTab === 'emails' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Type</th>
                      <th className="px-4 py-2 font-semibold">Subject</th>
                      <th className="px-4 py-2 font-semibold">Delivery Status</th>
                      <th className="px-4 py-2 font-semibold">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.emailLogs.filter(l => l.memberId === selectedMember.id).map(l => (
                      <tr key={l.id}>
                        <td className="px-4 py-2 font-medium">{l.type}</td>
                        <td className="px-4 py-2">{l.subject}</td>
                        <td className="px-4 py-2"><StatusBadge status={l.status} size="sm" /></td>
                        <td className="px-4 py-2">{formatDateTime(l.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeDetailTab === 'audit' && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Action</th>
                      <th className="px-4 py-2 font-semibold">Description</th>
                      <th className="px-4 py-2 font-semibold">Result</th>
                      <th className="px-4 py-2 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {state.auditLog.filter(a => a.entityId === selectedMember.id || a.description.includes(selectedMember.fullName)).map(a => (
                      <tr key={a.id}>
                        <td className="px-4 py-2 font-medium">{a.action}</td>
                        <td className="px-4 py-2">{a.description}</td>
                        <td className="px-4 py-2"><StatusBadge status={a.result} size="sm" /></td>
                        <td className="px-4 py-2">{formatDateTime(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default MemberDirectory;
