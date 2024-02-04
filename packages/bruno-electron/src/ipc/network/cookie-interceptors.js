const { default: axios, AxiosError } = require('axios');
const { getCookieStringForUrl, addCookieToJar } = require('../../utils/cookies');

const DEFAULT_MAX_REDIRECTS = 5;

function addRequestCookieInterceptor(axiosInstance) {
  axiosInstance.interceptors.request.use((config) => {
    const cookieString = getCookieStringForUrl(config.url);

    if (cookieString && typeof cookieString === 'string' && cookieString.length) {
      config.headers['cookie'] = cookieString;
    }

    return config;
  });
}

function addResponseCookieInterceptor(axiosInstance) {
  let maxRedirects = axiosInstance.defaults.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  //There is no control over flow if we have auto re-directs
  axiosInstance.defaults.maxRedirects = 0;

  axiosInstance.interceptors.response.use(
    (response) => {
      updateCookieJar(response);

      return response;
    },
    (error) => {
      if (error.response && isRedirectCode(error.response.status)) {
        if (maxRedirects-- < 0) {
          error.name = AxiosError.ERR_FR_TOO_MANY_REDIRECTS;
          return Promise.reject(error);
        }

        updateCookieJar(error.response);

        const redirectUrl = error.response.headers.location;
        return axiosInstance.get(redirectUrl);
      }
    }
  );
}

const updateCookieJar = (response) => {
  if (response.headers['set-cookie']) {
    let setCookieHeaders = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie']
      : [response.headers['set-cookie']];

    for (let setCookieHeader of setCookieHeaders) {
      if (typeof setCookieHeader === 'string' && setCookieHeader.length) {
        addCookieToJar(setCookieHeader, response.config.url);
      }
    }
  }
};

const isRedirectCode = (status) => [301, 302, 303, 307, 308].includes(status);

module.exports = {
  addRequestCookieInterceptor,
  addResponseCookieInterceptor
};
