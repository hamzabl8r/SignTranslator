import { useState } from "react";
import "./Styles/Login.css";
import { useDispatch } from "react-redux";
import "./Styles/Register.css";
import { userLogin, userRegister , userCurrent } from "../redux/Slice/userSlice";
import { Link, useNavigate } from "react-router-dom";

const Auth = () => {  
  const [isLoginView, setIsLoginView] = useState(true);
  
  const googleLogin = () => {
    window.location.href = "https://backpfe-production-789f.up.railway.app/auth/google";
  };

  const logo = "/logo.png";
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // --- Login Logic ---
  const [log, setLog] = useState({
    email: "",
    password: "",
  });

 const handleLogin = async (e) => {
  e.preventDefault();
  try {
    const resultAction = await dispatch(userLogin(log));

    if (userLogin.fulfilled.match(resultAction)) {
      await dispatch(userCurrent());
      console.log("Login successful, navigating to profil");
      navigate(`/profil`);
    } else {
      const errorMessage = resultAction.payload?.msg || 
                          resultAction.error?.message ||
                          "Login failed! Please check your credentials.";
      console.log("Login failed:", errorMessage);
      alert(errorMessage);
    }
  } catch (error) {
    console.error("An error occurred during login:", error);
    alert("An error occurred. Please try again later.");
  }
};

  // --- Register Logic ---
  const [registerData, setRegisterData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phoneNumber: "",
    isAdmin: false,
  });

  const [dateOfBirth, setdateOfBirth] = useState("");

  const handleRegisterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setRegisterData({
      ...registerData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const finalRegisterData = { ...registerData, dateOfBirth };
    console.log("Submitting:", finalRegisterData);

    const resultAction = await dispatch(userRegister(finalRegisterData));

    if (userRegister.fulfilled.match(resultAction)) {
      alert("Registration successful! Please login.");
      setIsLoginView(true);
      setRegisterData({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        phoneNumber: "",
        isAdmin: false,
      });
      setdateOfBirth("");
      navigate(`/profil`);
    } else {
      const errorMessage = resultAction.payload?.msg || 
                          resultAction.error?.message ||
                          "Registration failed. Please try again.";
      alert(errorMessage);
    }
  };

  return (
    <>
      {isLoginView ? (
        // --- Login Form ---
        <div className="login">
          <div className="login-container">
            <div className="logo">
              <img src={logo} alt="Logo" className="logo-png" />
            </div>
            <div className="btn-head">
              <button className="btn-login active">Login</button>
              <button
                className="btn-register"
                onClick={() => setIsLoginView(false)}>
                Register
              </button>
            </div>
            <div className="login-form">
              <form onSubmit={handleLogin}>
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  required
                  onChange={(e) => setLog({ ...log, email: e.target.value })}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Password"
                  required
                  onChange={(e) => setLog({ ...log, password: e.target.value })}
                />
                <div className="double-btn">
                  <button type="submit" className="login-btn">
                    LOGIN
                  </button>
                  <Link to="/forgot-password" className="forgot-password">
                    <button type="button" className="forgot-btn">
                      Forgot Password?
                    </button>
                  </Link>
                </div>
                <button type="button" onClick={googleLogin} className="buttonStyle">
                  <img src="/google.png" alt="google" width="25px" style={{ marginRight: "10px" }} />
                  <span> Login with Google</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        // --- Register Form ---
        <div className="register">
          <div className="register-container">
          <div className="logo">
              <img src={logo} alt="Logo" className="logo-png" />
            </div>
            <div className="btn-head">
              <button
                className="btn-login"
                onClick={() => setIsLoginView(true)}>
                Login
              </button>
              <button className="btn-register active">Register</button>
            </div>
            <div className="register-form">
              <form onSubmit={handleRegisterSubmit}>
                <input
                  className="input"
                  type="text"
                  name="firstName"
                  placeholder="First Name"  
                  value={registerData.firstName}
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  className="input"
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={registerData.lastName}
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  className="input"
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={registerData.email}
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  className="input"
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={registerData.password}
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  className="input"
                  type="text"
                  name="phoneNumber"
                  placeholder="Phone Number"
                  value={registerData.phoneNumber}
                  onChange={handleRegisterChange}
                  required
                />
                <input
                  className="input"
                  type="date"
                  name="dateOfBirth"
                  placeholder="Date Of Birth"
                  value={dateOfBirth}
                  onChange={(e) => setdateOfBirth(e.target.value)}
                  required
                />
                <br />
                <div className="double-btn">
                  <button type="submit" className="register-btn">
                    Register
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Auth;