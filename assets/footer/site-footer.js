(() => {
  "use strict";
  const publicContact = Object.freeze({
    name: "SehatLine Healthcare",
    founder: "Abhigyan Srivastava",
    address: "Gopalganj, Bihar 841428",
    email: "support@sehatline.in",
    phone: "+91 70618 63790",
    hours: "Monday–Saturday · 9:00 AM–7:00 PM IST"
  });
  function footerMarkup() {
    const phone = publicContact.phone ? `<a href="tel:${publicContact.phone.replace(/[^+\d]/g, "")}">${publicContact.phone}</a>` : "";
    return `<footer class="sehatline-site-footer" data-sehatline-footer aria-label="SehatLine company and contact information">
      <div class="sehatline-footer-careline"><span>Need help?</span><strong>Our support team is here for patients, doctors and healthcare partners.</strong><a href="mailto:${publicContact.email}?subject=SehatLine%20support%20request">Contact support</a></div>
      <div class="sehatline-footer-inner">
        <section class="sehatline-footer-about" aria-labelledby="sehatline-footer-title">
          <a class="sehatline-footer-brand" href="/" aria-label="SehatLine home"><img src="/assets/logos/sehatline-mark-frame.png" alt=""><span><strong id="sehatline-footer-title">SehatLine</strong><small>Smarter care. Better life.</small></span></a>
          <h2>About us</h2>
          <p>SehatLine Healthcare connects patients with admin-verified doctors through transparent discovery, appointments and live clinic operations. We are building accessible digital healthcare services for every family.</p>
          <div class="sehatline-footer-trust"><span>Verified doctors</span><span>Secure access</span><span>Patient-first care</span></div>
        </section>
        <section class="sehatline-footer-company"><h2>Company</h2><address><strong>${publicContact.name}</strong><br>Founder &amp; Owner: ${publicContact.founder}<br>${publicContact.address}</address><span class="sehatline-footer-hours">${publicContact.hours}</span></section>
        <section><h2>Support &amp; care</h2><a href="mailto:${publicContact.email}?subject=Patient%20support">Patient support</a><a href="mailto:${publicContact.email}?subject=Doctor%20onboarding">Doctor onboarding</a><a href="mailto:${publicContact.email}?subject=Clinic%20or%20partner%20support">Clinic &amp; partner support</a><span class="sehatline-footer-emergency">For a medical emergency, call 112 or visit the nearest emergency department.</span></section>
        <section><h2>Contact us</h2><a href="mailto:${publicContact.email}">${publicContact.email}</a>${phone}<span class="sehatline-footer-hours">Gopalganj, Bihar, India</span></section>
        <nav aria-label="SehatLine portals"><h2>Apps &amp; portals</h2><a href="/patient/">Patient App</a><a href="/doctor/">Doctor App</a><a href="/receptionist/">Receptionist Portal</a><a href="/admin/login">Secure Admin Login</a></nav>
      </div>
      <div class="sehatline-footer-bottom"><span>© ${new Date().getFullYear()} SehatLine Healthcare. All rights reserved.</span><span>Privacy-first · Admin-verified network · SehatLine does not replace emergency care or a doctor’s diagnosis.</span></div>
    </footer>`;
  }
  function mountFooter() { if (!document.querySelector("[data-sehatline-footer]")) document.body.insertAdjacentHTML("beforeend", footerMarkup()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountFooter, { once: true }); else mountFooter();
  window.SEHATLINE_PUBLIC_CONTACT = publicContact;
})();
