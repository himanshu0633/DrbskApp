import axios from "axios";
// import { toast } from "react-toastify";
import API_URL from "../../../config";
// import SweetAlert from "../CustomSwal";

const axiosInstance = axios.create({
  baseURL: API_URL,
});

// axiosInstance.interceptors.request.use(
//   (config) => {
//     // const token = sessionStorage.getItem("userToken");
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => {
//     return Promise.reject(error);
//   }
// );

export const setupAxiosInterceptors = (navigate, params) => {
  axiosInstance.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        // toast.error("Session expired. Please sign in again.");
        // sessionStorage.clear();
        const org_id = params?.org_id;
        if (org_id) {
          navigate(`/client/${org_id}/login`);
        } else {
          navigate("/superadmin/login");
        }
      }
      return Promise.reject(error);
    }
  );
};

export default axiosInstance;
