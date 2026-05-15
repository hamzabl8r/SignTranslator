import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { updateProfilePic, userCurrent, editUser } from '../redux/Slice/userSlice';
import './Styles/Profile.css';
import SeoHelmet from './SeoHelmet';

const Profil = () => {
    const [updatePict, setUpdatePict] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [updating, setUpdating] = useState(false);

    const dispatch = useDispatch();
    const user = useSelector((state) => state.user.user);
    const [file, setFile] = useState(null);
    const { toast, showToast, hideToast } = useToast();

    const [editData, setEditData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        phoneNumber: user?.phoneNumber || '',
        dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
        password: '',
        confirmPassword: '',
    });

    useEffect(() => {
        if (user) {
            setEditData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
                password: '',
                confirmPassword: '',
            });
        }
    }, [user]);

    const handleUpload = async () => {
        if (!file) { showToast("Please select a file first", "error"); return; }
        setUploading(true);
        const formData = new FormData();
        formData.append("profilePic", file);
        try {
            await dispatch(updateProfilePic({ formData })).unwrap();
            setUpdatePict(false);
            setFile(null);
            await dispatch(userCurrent());
            showToast("Photo updated successfully!", "success");
        } catch (error) {
            showToast("Upload failed: " + (error?.msg || error), "error");
        } finally {
            setUploading(false);
        }
    };

    const handleCancel = () => {
        setUpdatePict(false);
        setFile(null);
        showToast("Upload cancelled", "info");
    };

    const handleEditClick = () => {
        setEditMode(true);
        setEditData({
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            email: user?.email || '',
            phoneNumber: user?.phoneNumber || '',
            dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
            password: '',
            confirmPassword: '',
        });
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (editData.password && editData.password !== editData.confirmPassword) {
            showToast("Passwords do not match", "error");
            return;
        }
        setUpdating(true);
        try {
            const payload = { ...editData };
            if (!payload.password) {
                delete payload.password;
                delete payload.confirmPassword;
            }
            delete payload.confirmPassword;
            await dispatch(editUser({ id: user._id, editprofil: payload })).unwrap();
            await dispatch(userCurrent());
            setEditMode(false);
            showToast("Profile updated successfully!", "success");
        } catch (error) {
            showToast("Update failed: " + (error?.msg || error), "error");
        } finally {
            setUpdating(false);
        }
    };

    const handleCancelEdit = () => {
        setEditMode(false);
    };

    const avatarSrc = user?.profilePic
        ? `https://backpfe-production-789f.up.railway.app${user.profilePic}`
        : "https://img.freepik.com/free-vector/user-blue-gradient_78370-4692.jpg?w=150";

    return (
        <>
            <SeoHelmet title="Profile - MediSign" />
            {toast && (
                <Toast message={toast.message} type={toast.type} onClose={hideToast} />
            )}

            <div className="profil-root">
                <div className="profil-card">

                    {/* Cover banner */}
                    <div className="cover-band">
                        <div className="avatar-wrap">
                            <img
                                src={avatarSrc}
                                alt="profile"
                                onError={(e) => {
                                    e.target.src = "https://img.freepik.com/free-vector/user-blue-gradient_78370-4692.jpg?w=150";
                                }}
                            />
                            <span className="online-badge" />
                        </div>
                    </div>

                    <div className="card-body">
                        {/* Name + Edit button */}
                        <div className="name-row">
                            <h1 className="display-name">
                                {user?.firstName} {user?.lastName}
                            </h1>
                            {!editMode && (
                                <button className="btn-edit" onClick={handleEditClick}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    Edit Profile
                                </button>
                            )}
                        </div>
                        <p className="member-tag">Member since : {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>

                        {/* Photo update section */}
                        <div className="photo-section">
                            {!updatePict ? (
                                <button className="btn-photo" onClick={() => setUpdatePict(true)}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                                    Change photo
                                </button>
                            ) : (
                                <div className="upload-section">
                                    <label className="file-label">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                                        {file ? file.name.slice(0, 22) + (file.name.length > 22 ? '…' : '') : 'Choose file'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => setFile(e.target.files[0])}
                                            disabled={uploading}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                    <button
                                        className="btn-upload"
                                        onClick={handleUpload}
                                        disabled={uploading || !file}
                                    >
                                        {uploading ? 'Uploading…' : 'Apply'}
                                    </button>
                                    <button
                                        className="btn-cancel-photo"
                                        onClick={handleCancel}
                                        disabled={uploading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        <hr className="divider" />

                        {/* View mode */}
                        {!editMode ? (
                            <div className="view-section">
                                <p className="section-label">Personal information</p>
                                <div className="info-grid">
                                    <div className="info-item">
                                        <span className="info-key">First name</span>
                                        <span className="info-val">{user?.firstName}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-key">Last name</span>
                                        <span className="info-val">{user?.lastName}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-key">Email</span>
                                        <span className="info-val">{user?.email}</span>
                                    </div>
                                    <div className="info-item">
                                        <span className="info-key">Phone</span>
                                        <span className="info-val">{user?.phoneNumber}</span>
                                    </div>
                                    {user?.dateOfBirth && (
                                        <div className="info-item full-width">
                                            <span className="info-key">Date of birth</span>
                                            <span className="info-val">
                                                {new Date(user.dateOfBirth).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'long', year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Edit mode */
                            <div className="edit-section">
                                <p className="section-label">Edit information</p>
                                <div className="edit-grid">
                                    <div className="edit-row">
                                        <label>First name</label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={editData.firstName}
                                            onChange={handleEditChange}
                                            disabled={updating}
                                        />
                                    </div>
                                    <div className="edit-row">
                                        <label>Last name</label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={editData.lastName}
                                            onChange={handleEditChange}
                                            disabled={updating}
                                        />
                                    </div>
                                </div>
                                <div className="edit-row">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={editData.email}
                                        onChange={handleEditChange}
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-row">
                                    <label>Phone number</label>
                                    <input
                                        type="tel"
                                        name="phoneNumber"
                                        value={editData.phoneNumber}
                                        onChange={handleEditChange}
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-row">
                                    <label>Date of birth</label>
                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        value={editData.dateOfBirth}
                                        onChange={handleEditChange}
                                        disabled={updating}
                                    />
                                </div>
                                <hr className="divider" />
                                <p className="section-label" style={{ marginTop: 0 }}>Change password (optional)</p>
                                <div className="edit-row">
                                    <label>New password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={editData.password}
                                        onChange={handleEditChange}
                                        placeholder="Leave blank to keep current"
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-row">
                                    <label>Confirm password</label>
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={editData.confirmPassword}
                                        onChange={handleEditChange}
                                        placeholder="Repeat new password"
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-actions">
                                    <button className="btn-cancel-edit" onClick={handleCancelEdit} disabled={updating}>
                                        Cancel
                                    </button>
                                    <button className="btn-save" onClick={handleSave} disabled={updating}>
                                        {updating ? 'Saving…' : 'Save changes'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {(uploading || updating) && (
                    <div className="loading-overlay">
                        <div className="spinner" />
                    </div>
                )}
            </div>
        </>
    );
};

export default Profil;
