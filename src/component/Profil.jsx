import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Toast from './Toast';
import { useToast } from '../hooks/useToast';
import { updateProfilePic, userCurrent, editUser } from '../redux/Slice/userSlice';
import './Styles/Profile.css';

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
        dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''
    });

    // Update editData when user changes
    useEffect(() => {
        if (user) {
            setEditData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''
            });
        }
    }, [user]);

    const handleUpload = async () => {
        if (!file) {
            showToast("Please select a file first", "error");
            return;
        }
        
        setUploading(true);
        const formData = new FormData();
        formData.append("profilePic", file);
        
        try {
            const response = await dispatch(updateProfilePic({ formData })).unwrap();
            console.log("Upload success:", response);
            setUpdatePict(false);
            setFile(null);
            await dispatch(userCurrent());
            showToast("Photo updated successfully!", "success");
        } catch (error) {
            console.error("Upload error:", error);
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
            dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split('T')[0] : ''
        });
        showToast("Edit mode activated", "info");
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = async () => {
        setUpdating(true);
        try {
            const result = await dispatch(editUser({ 
                id: user._id, 
                editprofil: editData 
            })).unwrap();
            
            console.log("Update success:", result);
            await dispatch(userCurrent());
            setEditMode(false);
            showToast("Profile updated successfully!", "success");
        } catch (error) {
            console.error("Update error:", error);
            showToast("Update failed: " + (error?.msg || error), "error");
        } finally {
            setUpdating(false);
        }
    };

    const handleCancelEdit = () => {
        setEditMode(false);
        showToast("Edit cancelled", "info");
    };

    return (
        <>
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={hideToast} 
                />
            )}
            <div className="profil-container">
                <div className="box">
                    <div className="profil-pict">
                        <img 
                            src={user?.profilePic 
                                ? `https://backpfe-production.up.railway.app${user.profilePic}` 
                                : "https://via.placeholder.com/150"} 
                            alt="profile" 
                            onError={(e) => { 
                                e.target.src = "https://img.freepik.com/free-vector/user-blue-gradient_78370-4692.jpg?semt=ais_hybrid&w=740&q=80"; 
                            }}
                        />
                        
                        {!updatePict ? (
                            <button onClick={() => setUpdatePict(true)} className="update-btn">
                                Update Photo
                            </button>
                        ) : (
                            <div className="upload-section">
                                <input 
                                    type="file" 
                                    onChange={(e) => setFile(e.target.files[0])} 
                                    accept="image/*"
                                    className="file-input"
                                    disabled={uploading}
                                />
                                <div className="upload-actions">
                                    <button 
                                        onClick={handleUpload}
                                        className="upload-submit-btn"
                                        disabled={uploading || !file}
                                    >
                                        {uploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                    <button 
                                        onClick={handleCancel}
                                        className="cancel-btn"
                                        disabled={uploading}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="info-section">
                        <div className="info-header">
                            <h3>Personal Information</h3>
                            {!editMode && (
                                <button onClick={handleEditClick} className="edit-info-btn">
                                    Edit Profile
                                </button>
                            )}
                        </div>
                        
                        {!editMode ? (
                            <div className="info-display">
                                <div className="info-row">
                                    <strong>Name:</strong>
                                    <span>{user?.firstName} {user?.lastName}</span>
                                </div>
                                <div className="info-row">
                                    <strong>Email:</strong>
                                    <span>{user?.email}</span>
                                </div>
                                <div className="info-row">
                                    <strong>Phone:</strong>
                                    <span>{user?.phoneNumber}</span>
                                </div>
                                {user?.dateOfBirth && (
                                    <div className="info-row">
                                        <strong>Date of Birth:</strong>
                                        <span>{new Date(user.dateOfBirth).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="info-edit">
                                <div className="edit-field">
                                    <label>First Name</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={editData.firstName}
                                        onChange={handleEditChange}
                                        className="edit-input"
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-field">
                                    <label>Last Name</label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        value={editData.lastName}
                                        onChange={handleEditChange}
                                        className="edit-input"
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-field">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={editData.email}
                                        onChange={handleEditChange}
                                        className="edit-input"
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-field">
                                    <label>Phone Number</label>
                                    <input
                                        type="tel"
                                        name="phoneNumber"
                                        value={editData.phoneNumber}
                                        onChange={handleEditChange}
                                        className="edit-input"
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-field">
                                    <label>Date of Birth</label>
                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        value={editData.dateOfBirth}
                                        onChange={handleEditChange}
                                        className="edit-input"
                                        disabled={updating}
                                    />
                                </div>
                                <div className="edit-actions">
                                    <button 
                                        onClick={handleSave} 
                                        className="save-btn"
                                        disabled={updating}
                                    >
                                        {updating ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button 
                                        onClick={handleCancelEdit} 
                                        className="cancel-edit-btn"
                                        disabled={updating}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {(uploading || updating) && (
                    <div className="loading-overlay">
                        <div className="spinner"></div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Profil;