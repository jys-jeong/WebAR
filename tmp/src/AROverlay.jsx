import React, { useEffect, useRef } from 'react';

const AROverlay = ({ markerData, onClose, isActive }) => {
  const arContainerRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    // AR.js 라이브러리 동적 로드
    if (!window.AFRAME) {
      const aframeScript = document.createElement('script');
      aframeScript.src = 'https://aframe.io/releases/1.4.0/aframe.min.js';
      aframeScript.onload = () => {
        const arjsScript = document.createElement('script');
        arjsScript.src = 'https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js';
        arjsScript.onload = initializeAR;
        document.head.appendChild(arjsScript);
      };
      document.head.appendChild(aframeScript);
    } else {
      initializeAR();
    }

    return cleanup;
  }, [isActive, markerData]);

  const initializeAR = () => {
    if (!arContainerRef.current) return;

    const arHTML = `
      <a-scene 
        embedded 
        arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: color; trackingMethod: best;"
        style="width: 100%; height: 100%;"
      >
        <a-assets>
          <img id="project-img" src="${markerData?.imageUrl || '/image.jpg'}" crossorigin="anonymous" />
        </a-assets>
        
        <!-- HIRO 마커 기반 AR -->
        <a-marker preset="hiro" id="main-marker">
          <!-- 프로젝트 이미지 -->
          <a-image 
            src="#project-img" 
            position="0 0 0" 
            rotation="-90 0 0"
            scale="2 2 2"
            animation="property: rotation; to: -90 360 0; loop: true; dur: 10000"
          ></a-image>
          
          <!-- 3D 텍스트 -->
          <a-text 
            value="${markerData?.title || '산책 프로젝트'}"
            position="0 1.5 0"
            align="center"
            color="#FFFFFF"
            scale="0.8 0.8 0.8"
          ></a-text>
          
          <!-- 3D 박스 (장식용) -->
          <a-box 
            position="0 0.5 0" 
            rotation="0 45 0"
            scale="0.3 0.3 0.3"
            color="#3A8049"
            animation="property: rotation; to: 0 405 0; loop: true; dur: 5000"
          ></a-box>
        </a-marker>
        
        <a-entity camera></a-entity>
      </a-scene>
    `;
    
    arContainerRef.current.innerHTML = arHTML;
  };

  const cleanup = () => {
    if (arContainerRef.current) {
      arContainerRef.current.innerHTML = '';
    }
  };

  if (!isActive) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'black',
        zIndex: 9999
      }}
    >
      {/* AR 컨테이너 */}
      <div ref={arContainerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* 상단 정보 패널 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        right: '20px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>{markerData?.title || '산책 지점'}</h3>
        <p style={{ margin: '0 0 10px 0' }}>{markerData?.description || 'AR 마커를 카메라에 비춰보세요!'}</p>
        <p style={{ margin: '0', fontSize: '12px', color: '#ccc' }}>
          📱 HIRO 마커를 스캔하거나 화면을 터치해서 3D 콘텐츠를 확인하세요
        </p>
      </div>
      
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: '#FF4444',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          fontSize: '24px',
          cursor: 'pointer',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </button>
      
      {/* HIRO 마커 이미지 (참고용) */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        maxWidth: '100px'
      }}>
        <div style={{ fontSize: '10px', marginBottom: '5px', color: 'black' }}>AR 마커</div>
        <img 
          src="https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png" 
          alt="HIRO Marker" 
          style={{ width: '80px', height: '80px' }}
        />
      </div>
    </div>
  );
};

export default AROverlay;
