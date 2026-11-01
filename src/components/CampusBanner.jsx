import React from 'react';
import { useNavigate } from 'react-router-dom';
import { recordBannerClick } from '../lib/db';
import { isExternalLink } from '../lib/campusBanner';

// Banner del campus (C3): una imagen con link, todo el banner es un solo clic.
// Los links externos se abren en otra pestaña para no sacar al alumno del campus.
// `preview`: vista previa del admin (no cuenta clics ni navega).
const CampusBanner = ({ banner, preview = false }) => {
  const navigate = useNavigate();
  if (!banner) return null;
  const external = isExternalLink(banner.link);
  const onClick = (e) => {
    if (preview) { e.preventDefault(); return; }
    recordBannerClick(banner.id).catch(() => {});
    if (!external) { e.preventDefault(); navigate(banner.link); }
  };
  return (
    <a className="campus-banner" href={banner.link} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} onClick={onClick} aria-label={banner.title}>
      <picture>
        {banner.mobileImage && <source media="(max-width: 640px)" srcSet={banner.mobileImage} />}
        <img src={banner.desktopImage} alt={banner.title} />
      </picture>
    </a>
  );
};

export default CampusBanner;
