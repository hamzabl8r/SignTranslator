import React from 'react';
import { Helmet } from 'react-helmet-async';

const SeoHelmet = ({ title, description = 'MediSign platform for sign language translation and communication.' }) => {
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
    </Helmet>
  );
};

export default SeoHelmet;
