/**
 * COM SC
 * GitHub Pages -> Apps Script Web App
 */

(() => {
  'use strict';

  const CONFIG = Object.freeze({
    API_URL:
      'https://script.google.com/macros/s/AKfycbyv4oCDPowBc20wyRN5RccBCE2bYMdoljSgG9KBHFFB3yZg1k8ZMwP4JEiRyBvbWcaN/exec',

    API_VERSION:
      'v1',

    STORAGE_KEY:
      'COMSC_ACCESS_KEY',

    REQUEST_TIMEOUT:
      20000
  });

  const state = {
    connected: false,
    bootstrap: null,
    settings: null,
    dashboard: null,
    classroomModule: null,
    classroomStudents: {}
  };

  function getAccessKey() {
    return String(
      localStorage.getItem(
        CONFIG.STORAGE_KEY
      ) || ''
    ).trim();
  }

  function saveAccessKey(key) {
    const value =
      String(key || '')
        .trim();

    if (!value) {
      return false;
    }

    localStorage.setItem(
      CONFIG.STORAGE_KEY,
      value
    );

    return true;
  }

  function clearAccessKey() {
    localStorage.removeItem(
      CONFIG.STORAGE_KEY
    );
  }

  function createCallbackName() {
    return (
      '__comsc_jsonp_' +
      Date.now() +
      '_' +
      Math.random()
        .toString(36)
        .slice(2)
    );
  }

  function jsonpRequest(
    action,
    params = {}
  ) {
    return new Promise(
      (resolve, reject) => {
        const callbackName =
          createCallbackName();

        const query =
          new URLSearchParams();

        query.set(
          'api',
          CONFIG.API_VERSION
        );

        query.set(
          'action',
          action
        );

        query.set(
          'callback',
          callbackName
        );

        Object.entries(
          params || {}
        ).forEach(
          ([key, value]) => {
            if (
              value !== undefined &&
              value !== null &&
              String(value) !== ''
            ) {
              query.set(
                key,
                String(value)
              );
            }
          }
        );

        const script =
          document.createElement(
            'script'
          );

        let finished =
          false;

        const timeout =
          window.setTimeout(
            () => {
              cleanup();

              reject(
                new Error(
                  'การเชื่อมต่อใช้เวลานานเกินไป'
                )
              );
            },
            CONFIG.REQUEST_TIMEOUT
          );

        function cleanup() {
          if (finished) {
            return;
          }

          finished =
            true;

          window.clearTimeout(
            timeout
          );

          try {
            delete window[
              callbackName
            ];
          } catch (_) {
            window[
              callbackName
            ] = undefined;
          }

          if (
            script.parentNode
          ) {
            script.parentNode
              .removeChild(
                script
              );
          }
        }

        window[
          callbackName
        ] = response => {
          cleanup();

          if (
            !response ||
            response.success !== true
          ) {
            const message =
              response &&
              response.error &&
              response.error.message
                ? response.error.message
                : 'ไม่สามารถเชื่อมต่อ COM SC ได้';

            reject(
              new Error(
                message
              )
            );

            return;
          }

          resolve(
            response
          );
        };

        script.onerror =
          () => {
            cleanup();

            reject(
              new Error(
                'ไม่สามารถติดต่อเซิร์ฟเวอร์ COM SC ได้'
              )
            );
          };

        script.src =
          CONFIG.API_URL +
          '?' +
          query.toString();

        document.head
          .appendChild(
            script
          );
      }
    );
  }

  async function ping() {
    return jsonpRequest(
      'ping'
    );
  }

  async function authenticatedRequest(
    action,
    params = {}
  ) {
    const key =
      getAccessKey();

    if (!key) {
      throw new Error(
        'ยังไม่ได้ตั้งค่ารหัสเชื่อมต่อ'
      );
    }

    return jsonpRequest(
      action,
      {
        ...params,
        key: key
      }
    );
  }

  async function getSystemBootstrap() {
    const response =
      await authenticatedRequest(
        'getSystemBootstrap'
      );

    const data =
      response.data ||
      {};

    state.connected =
      true;

    state.bootstrap =
      data;

    state.settings =
      data.settings ||
      {};

    state.dashboard =
      data.dashboard ||
      {};

    window.dispatchEvent(
      new CustomEvent(
        'comsc:bootstrap',
        {
          detail:
            data
        }
      )
    );

    return data;
  }

  async function getClassroomModuleData() {
    const response =
      await authenticatedRequest(
        'getClassroomModuleData'
      );

    const data =
      response.data ||
      {};

    state.classroomModule =
      data;

    window.dispatchEvent(
      new CustomEvent(
        'comsc:classrooms',
        {
          detail:
            data
        }
      )
    );

    return data;
  }

  async function getClassroomStudents(
    classId
  ) {
    const targetClassId =
      String(
        classId || ''
      ).trim();

    if (!targetClassId) {
      throw new Error(
        'กรุณาเลือกห้องเรียน'
      );
    }

    const response =
      await authenticatedRequest(
        'getClassroomStudents',
        {
          classId:
            targetClassId
        }
      );

    const data =
      response.data ||
      {};

    state.classroomStudents[
      targetClassId
    ] = data;

    window.dispatchEvent(
      new CustomEvent(
        'comsc:classroom-students',
        {
          detail: {
            classId:
              targetClassId,
            data:
              data
          }
        }
      )
    );

    return data;
  }

  async function connect(
    accessKey
  ) {
    if (
      accessKey
    ) {
      saveAccessKey(
        accessKey
      );
    }

    try {
      await ping();

      const data =
        await getSystemBootstrap();

      return {
        success: true,
        data:
          data
      };
    } catch (error) {
      state.connected =
        false;

      throw error;
    }
  }

  function showConnectionDialog() {
    return new Promise(
      (resolve, reject) => {
        const old =
          document.getElementById(
            'comsc-connection-dialog'
          );

        if (
          old
        ) {
          old.remove();
        }

        const overlay =
          document.createElement(
            'div'
          );

        overlay.id =
          'comsc-connection-dialog';

        overlay.style.cssText =
          [
            'position:fixed',
            'inset:0',
            'z-index:999999',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:20px',
            'background:rgba(15,23,42,.48)',
            'backdrop-filter:blur(12px)',
            '-webkit-backdrop-filter:blur(12px)'
          ].join(';');

        const card =
          document.createElement(
            'div'
          );

        card.style.cssText =
          [
            'width:min(100%,420px)',
            'background:#fff',
            'border-radius:28px',
            'box-shadow:0 24px 80px rgba(15,23,42,.24)',
            'padding:28px',
            'font-family:Prompt,system-ui,-apple-system,sans-serif'
          ].join(';');

        card.innerHTML =
          `
            <div style="
              display:flex;
              align-items:center;
              gap:14px;
              margin-bottom:22px;
            ">
              <img
                src="https://s.imgz.io/2026/08/31/Logo-384c5649d9c8e9035.png"
                alt="COM SC"
                style="
                  width:58px;
                  height:58px;
                  object-fit:contain;
                "
              >
              <div>
                <div style="
                  font-size:20px;
                  font-weight:800;
                  color:#0B1F3A;
                ">
                  COM SC
                </div>

                <div style="
                  margin-top:3px;
                  font-size:13px;
                  color:#718096;
                ">
                  เชื่อมต่อระบบสำหรับเครื่องนี้
                </div>
              </div>
            </div>

            <label
              for="comsc-access-key-input"
              style="
                display:block;
                margin-bottom:8px;
                font-size:13px;
                font-weight:700;
                color:#334155;
              "
            >
              รหัสเชื่อมต่อ
            </label>

            <input
              id="comsc-access-key-input"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="กรอกรหัสเชื่อมต่อ"
              style="
                box-sizing:border-box;
                width:100%;
                height:50px;
                border:1px solid #CBD5E1;
                border-radius:14px;
                padding:0 15px;
                outline:none;
                font-size:16px;
                color:#0F172A;
                background:#F8FAFC;
              "
            >

            <div
              id="comsc-access-key-error"
              style="
                display:none;
                margin-top:10px;
                font-size:13px;
                line-height:1.5;
                color:#B91C1C;
              "
            ></div>

            <button
              id="comsc-connect-button"
              type="button"
              style="
                width:100%;
                height:50px;
                margin-top:18px;
                border:0;
                border-radius:14px;
                background:#146EF5;
                color:#fff;
                font-family:inherit;
                font-size:15px;
                font-weight:800;
                cursor:pointer;
              "
            >
              เชื่อมต่อ
            </button>
          `;

        overlay.appendChild(
          card
        );

        document.body
          .appendChild(
            overlay
          );

        const input =
          card.querySelector(
            '#comsc-access-key-input'
          );

        const button =
          card.querySelector(
            '#comsc-connect-button'
          );

        const errorBox =
          card.querySelector(
            '#comsc-access-key-error'
          );

        async function submit() {
          const key =
            String(
              input.value ||
              ''
            ).trim();

          if (!key) {
            errorBox.textContent =
              'กรุณากรอกรหัสเชื่อมต่อ';

            errorBox.style.display =
              'block';

            input.focus();

            return;
          }

          button.disabled =
            true;

          button.textContent =
            'กำลังเชื่อมต่อ...';

          errorBox.style.display =
            'none';

          try {
            const result =
              await connect(
                key
              );

            overlay.remove();

            resolve(
              result
            );
          } catch (error) {
            clearAccessKey();

            errorBox.textContent =
              error &&
              error.message
                ? error.message
                : 'เชื่อมต่อไม่สำเร็จ';

            errorBox.style.display =
              'block';

            button.disabled =
              false;

            button.textContent =
              'เชื่อมต่อ';

            input.select();
          }
        }

        button.addEventListener(
          'click',
          submit
        );

        input.addEventListener(
          'keydown',
          event => {
            if (
              event.key ===
              'Enter'
            ) {
              submit();
            }
          }
        );

        window.setTimeout(
          () => {
            input.focus();
          },
          50
        );
      }
    );
  }

  async function initialize() {
    try {
      await ping();

      const key =
        getAccessKey();

      if (
        key
      ) {
        try {
          await getSystemBootstrap();

          return;
        } catch (error) {
          clearAccessKey();
        }
      }

      await showConnectionDialog();
    } catch (error) {
      console.error(
        'COM SC:',
        error
      );

      window.dispatchEvent(
        new CustomEvent(
          'comsc:error',
          {
            detail: {
              message:
                error &&
                error.message
                  ? error.message
                  : 'ไม่สามารถเชื่อมต่อระบบได้'
            }
          }
        )
      );
    }
  }

  window.COMSC =
    Object.freeze({
      state:
        state,

      ping:
        ping,

      connect:
        connect,

      bootstrap:
        getSystemBootstrap,

      getClassroomModuleData:
        getClassroomModuleData,

      getClassroomStudents:
        getClassroomStudents,

      getAccessKey:
        getAccessKey,

      saveAccessKey:
        saveAccessKey,

      clearAccessKey:
        clearAccessKey
    });

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initialize
    );
  } else {
    initialize();
  }
})();
