import React, { Fragment, useState } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Head from '@docusaurus/Head';
import { Dialog } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const footerNavigation = {
  main: [
    { name: 'About', href: '/docs' },
    { name: 'Documentation', href: '/docs' },
    { name: 'Blog', href: '/blog' },
    { name: 'Privacy', href: '/privacy-policy' },
    { name: 'Contact', href: 'mailto:cfu288@meremedical.co' },
  ],
  social: [],
};

const features = [
  {
    name: 'Sync from patient portals',
    img: '/img/sync.svg',
    description:
      'Connect to all of your patient portals across doctors and hospitals and see all of your data in one place. Let us help you manage your medical records.',
  },
  {
    name: 'Self-Hosted',
    img: '/img/self.svg',
    description:
      'Mere respects the privacy, security, and integrity of your info at all times. Run it on your own servers at home without worrying about your sensitive data falling into the wrong hands.',
  },
  {
    name: 'Offline First',
    img: '/img/offline.svg',
    description:
      'Mere is offline-first. Everything will be available right on your device for anytime-access – whether you’re connected to the web or not.',
  },
  {
    name: 'Reminders',
    img: '/img/reminders.svg',
    description:
      'Use your data to generate health recommendations, wellness metrics, and reminders when it’s time to see the doctor again – all from one intuitive dashboard.',
  },
  {
    name: 'Anonymous & Secure',
    img: '/img/secure.svg',
    description:
      'With Mere, you are always in control of your data. Stay offline, sync online – the choice is yours.',
  },
  {
    name: 'Free for Everyone',
    img: '/img/free.svg',
    description:
      'Every patient has the right to control their own healthcare data. That’s why Mere Medical is free to use, deploy, and extend.',
  },
];

const navigation = [
  { name: 'About Mere', href: '/docs' },
  { name: 'Documentation', href: '/docs' },
  { name: 'Blog', href: '/blog' },
];

export function NavigationBar({ absolute = true }: { absolute?: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className={`${
        absolute ? 'absolute' : ''
      } top-0 left-0 isolate z-50 w-full`}
    >
      <div className="px-6 py-6 lg:px-8">
        <nav
          className="flex w-full items-center justify-between"
          aria-label="Global"
        >
          <div className="flex lg:flex-1">
            <a href="#" className="-m-1.5 p-1.5">
              <img
                className="block h-10 lg:hidden"
                src="/img/logo.svg"
                alt=""
              />
            </a>
          </div>
          <div className="flex lg:hidden">
            <button
              type="button"
              className="-m-2.5 inline-flex items-center justify-center rounded-md border-0 bg-gray-50 p-2.5 text-gray-700 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(true)}
            >
              <span className="sr-only">Open main menu</span>
              <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-sm leading-6 text-gray-700"
              >
                {item.name}
              </a>
            ))}
          </div>
          {mobileMenuOpen && (
            <div className="fixed inset-0 z-10 overflow-y-auto bg-white px-6 py-6 lg:hidden">
              <div className="flex items-center justify-between">
                <a href="#" className="-m-1.5 p-1.5">
                  <img className="h-10 w-auto" src="/img/logo.svg" alt="logo" />
                </a>
                <button
                  type="button"
                  className="-m-2.5 inline-flex items-center justify-center rounded-md border-0 bg-gray-50 p-2.5 text-gray-700 hover:bg-gray-100"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="sr-only">Close menu</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-6 flow-root">
                <div className="-my-6 divide-y divide-gray-500/10">
                  <div className="space-y-2 py-6">
                    {navigation.map((item) => (
                      <a
                        key={item.name}
                        href={item.href}
                        className="-mx-3 block rounded-lg py-2 px-3 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-400/10"
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                  <div className="py-6">
                    <a
                      href="#"
                      className="-mx-3 block rounded-lg py-2.5 px-3 text-base font-semibold leading-6 text-gray-900 hover:bg-gray-400/10"
                    ></a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <>
      <Head>
        <meta
          name="description"
          content="Manage all of your medical records in one place. Mere is a personal health record that syncs your records across hospital systems for you. Open-source, self-hostable, and offline-first"
        />
        <meta
          property="og:description"
          content="Manage all of your medical records in one place. Mere is a personal health record that syncs your records across hospital systems for you. Open-source, self-hostable, and offline-first"
        />
        {process.env.NODE_ENV === 'production' && (
          <script
            async
            defer
            data-website-id="923df902-e3c6-4d55-8c84-51cd5881ed81"
            src="https://umami.mari.casa/umami.js"
          ></script>
        )}
      </Head>
      <NavigationBar />
      <main className="relative overflow-x-hidden overflow-y-hidden bg-white">
        {/* Hero section */}
        <div className="flex min-h-screen flex-col items-center justify-center py-8 sm:py-12 lg:relative">
          <div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:grid-cols-1 sm:px-6 lg:grid lg:max-w-7xl lg:grid-cols-2 lg:gap-24 lg:px-8">
            {/* Left Hero */}
            <div>
              <div>
                <img
                  className="slideUp hidden h-11 w-auto lg:block"
                  src="/img/logo.svg"
                  alt="logo"
                />
              </div>
              <div className="mt-24 sm:mt-12">
                <div className="mt-6 sm:max-w-xl">
                  <h1 className="slideUp text-primary-900 text-5xl font-bold tracking-tight sm:text-5xl">
                    Your Whole Medical Story.
                  </h1>
                  <h1 className="slideUp text-primary-900 text-5xl font-bold tracking-tight sm:text-5xl">
                    One Place.
                  </h1>
                  <p className="slideUpDelay1 mt-6 text-xl leading-relaxed text-gray-600 opacity-0">
                    With Mere Medical, you can finally manage all of your
                    medical records locally on your device.
                  </p>
                </div>
                <div className="mt-5 max-w-md sm:flex sm:justify-start md:mt-8">
                  <div className="slideUpDelay2 rounded-md opacity-0 shadow">
                    <a
                      href="https://demo.meremedical.co"
                      className="bg-primary-700 hover:bg-primary-600 flex w-full items-center justify-center rounded-md border border-transparent px-8 py-3 text-base font-medium text-white hover:text-white md:py-4 md:px-10 md:text-lg"
                    >
                      See Demo
                    </a>
                  </div>
                  <div className="slideUpDelay3 mt-3 rounded-md opacity-0 shadow sm:mt-0 sm:ml-3">
                    <a
                      href="https://app.meremedical.co"
                      className="text-primary-700 hover:text-primary-600 flex w-full items-center justify-center rounded-md border border-transparent bg-white px-8 py-3 text-base font-medium hover:bg-gray-50 md:py-4 md:px-10 md:text-lg"
                    >
                      Try the Beta
                    </a>
                  </div>
                </div>
                <div className="fadeInDelay1 mt-24 opacity-0">
                  <h2 className="text-sm font-normal leading-8 text-gray-700">
                    Sync data from popular patient portals
                  </h2>
                  <div className="mx-auto mt-10 grid max-w-lg grid-cols-4 items-center gap-x-8 gap-y-10 sm:grid-cols-6 sm:gap-x-10 lg:mx-0 lg:grid-cols-6">
                    <img
                      className="col-span-2 max-h-12 w-full object-contain grayscale lg:col-span-2"
                      src="/img/MyChartLogo.png"
                      alt="Epic MyChart Patient Portal"
                      width={158 * 0.75}
                      height={48 * 0.75}
                    />
                    <img
                      className="col-span-2 max-h-12 w-full object-contain grayscale lg:col-span-2"
                      src="/img/CernerHealthLogo.png"
                      alt="Cerner Health Patient Portal"
                      width={158 * 0.75}
                      height={48 * 0.75}
                      style={{
                        filter:
                          'grayscale invert(17%) sepia(60%) saturate(5044%) hue-rotate(182deg) brightness(91%) contrast(101%)',
                      }}
                    />
                    <img
                      className="col-span-2 max-h-12 w-full object-contain grayscale lg:col-span-2"
                      src="/img/AllscriptsLogo.png"
                      alt="Allscripts Connect Patient Portal"
                      width={158 * 0.75}
                      height={48 * 0.75}
                    />
                    <img
                      className="col-span-2 max-h-12 w-full object-contain grayscale sm:col-start-2 lg:col-span-2 lg:col-start-2"
                      src="/img/OnpatientLogo.png"
                      alt="Onpatient Patient Portal"
                      width={158 * 0.75}
                      height={48 * 0.75}
                    />
                    <img
                      className="col-span-2 col-start-2 max-h-12 w-full object-contain grayscale sm:col-start-auto lg:col-span-2"
                      src="/img/FollowMyHealthLogo.png"
                      alt="Onpatient Patient Portal"
                      width={158 * 0.75}
                      height={48 * 0.75}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Hero */}
            <div className="lg:rounded-tr-0 lg:left-100 relative mt-24 flex h-80 w-auto overflow-hidden rounded-bl-[80px] rounded-tr-[80px] bg-[#F1F4F9] px-4 sm:h-[32rem] lg:absolute lg:inset-y-0 lg:left-1/2 lg:right-0 lg:mt-0 lg:block lg:h-4/5 lg:w-full lg:overflow-visible lg:px-0 lg:pt-6">
              <img
                className="fadeIn m-5 mx-auto self-center rounded-md opacity-0 sm:max-w-xl lg:absolute lg:-bottom-10 lg:mx-0 lg:mb-0 lg:mt-20 lg:ml-10 lg:h-auto lg:w-full lg:max-w-5xl lg:self-center lg:rounded-2xl lg:p-0"
                src="/img/timeline-desktop.webp"
                alt="web timeline screenshot"
              />
            </div>
          </div>
        </div>

        <div className="bg-white py-12">
          <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
            <div className="bg-primary-900 relative overflow-hidden px-6 py-10 shadow-xl sm:rounded-3xl sm:px-10 sm:py-12 md:px-12 lg:px-20">
              <div className="relative mx-auto lg:mx-0">
                <figure>
                  <blockquote className="mt-6 text-lg font-semibold text-white sm:text-xl sm:leading-8">
                    <p>
                      “Just wanted to let you know that my grandma ended up in
                      hospital (she is okay now) and I am using Mere to try to
                      get her records in one place so we can figure out best
                      steps and its been helpful 🙂
                    </p>
                    <p>
                      So I just wanted to thank you for what you have built”
                    </p>
                  </blockquote>
                  <figcaption className="mt-6 text-base text-white">
                    <div className="font-light">
                      Actual feedback from a user
                    </div>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </div>

        {/* Problem section */}
        <div className="relative py-12">
          <div className="mx-auto flex max-w-md flex-col-reverse items-center justify-center px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:flex-row-reverse lg:items-start lg:gap-24 lg:px-8">
            {/* <div className="flex h-full grow items-center justify-center overflow-hidden lg:order-1 lg:w-full"> */}
            <img
              className="mt-12 h-auto max-h-[512px] w-full max-w-[512px] self-center justify-self-center object-cover lg:order-1 lg:mt-0"
              src="/img/snippets.webp"
              alt=""
            />
            {/* </div> */}

            <div className="mx-auto max-w-md sm:max-w-3xl sm:px-6 lg:px-0">
              {/* Content area */}
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                  What’s the Problem?
                </h2>
                <div className="mt-6 space-y-6 text-gray-600">
                  <p className="text-lg leading-relaxed">
                    Your medical records are yours. So, why is it so hard to
                    access them?
                  </p>
                  <p className="text-lg leading-relaxed">
                    Medical record organization is critical. With the rise of
                    the digital age, managing your patient profile should be
                    easy.
                  </p>
                  <p className="text-lg leading-relaxed">
                    Today, our medical records are all over the place - saved as
                    PDF's on a computer, as images on our phones, even in tall
                    stacks of paper in some filing cabinet. Even when we have
                    access to our medical records via online patient portals, we
                    have a different portal for each hospital and doctor we
                    visit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Solution section */}
        <div className="bg-[#006182] py-24">
          <div className="mx-auto max-w-md px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-24">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                  What’s the Solution?
                </h2>
                <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white">
                  Mere Medical is a personal health record focused on empowering
                  patients by prioritizing user privacy, control, and
                  experience.
                </p>
                <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white">
                  Mere is an open-source, self-hostable, local-first, and free
                  personal health record that connects to multiple patient
                  portals and allows you to upload your own paper records. With
                  Mere, you can easily manage your own medical records under one
                  digital roof.
                </p>
                <div className="mb-0 mt-8 flex items-center justify-start rounded-md bg-[#8799D040] p-4">
                  <div className="ml-2 mr-4 flex aspect-square h-[35px] w-[35px] items-center justify-center rounded-full bg-[#7CE8C7]">
                    <p className="text-primary-900 mb-0 text-lg">1</p>
                  </div>
                  <p className=" text-md mb-0 flex h-max max-w-xl items-center justify-center align-bottom font-semibold leading-7 text-white">
                    Offline first - Everything is stored locally on your device
                  </p>
                </div>
                <div className="mt-8 flex items-center justify-start rounded-md bg-[#8799D040] p-4">
                  <div className="ml-2 mr-4 flex aspect-square h-[35px] w-[35px] items-center justify-center rounded-full bg-[#7CE8C7]">
                    <p className="text-primary-900 mb-0 text-lg">2</p>
                  </div>
                  <p className="text-md mb-0 flex h-max max-w-xl items-center justify-center align-bottom font-semibold leading-7 text-white">
                    No sign in required - start using without creating an
                    account
                  </p>
                </div>
                <div className="mt-8 flex items-center justify-start rounded-md bg-[#8799D040] p-4">
                  <div className="ml-2 mr-4 flex aspect-square h-[35px] w-[35px] items-center justify-center rounded-full bg-[#7CE8C7]">
                    <p className="text-primary-900 mb-0 text-lg">3</p>
                  </div>
                  <p className="text-md mb-0 flex h-max max-w-xl items-center justify-center align-bottom font-semibold leading-7 text-white">
                    Wrangle your data - multiple data sources, one place
                  </p>
                </div>
              </div>

              {/* Screenshot */}
              <div className="mt-12 flex aspect-square items-center justify-center overflow-hidden rounded-2xl lg:mt-0">
                <img
                  className="h-full max-h-[512px] w-auto max-w-[512px] object-cover"
                  src="/img/solution.webp"
                  alt=""
                />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">
                Our Goals
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                {/* Decentralizing Patient Data */}
              </p>
            </div>
            <dl className="mt-12 space-y-4 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-12 sm:space-y-0 lg:grid-cols-3 lg:gap-x-8">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="flex min-h-[250px] flex-col rounded-md border-2 border-solid border-slate-100 p-6"
                >
                  <dt className="flex flex-col">
                    <img
                      src={feature.img}
                      className="h-[84px] w-[84px] text-green-600"
                      aria-hidden="true"
                    />
                    <p className="mt-8 text-2xl font-semibold text-gray-900">
                      {feature.name}
                    </p>
                  </dt>
                  <dd className="mt-4 ml-0 font-light text-gray-600">
                    {feature.description}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Goals section */}
        <div className="relative pb-12 sm:pt-12"></div>
      </main>
      <Footer />
    </>
  );
}

export function Footer() {
  return (
    <footer className="bg-primary-900">
      <div className="mx-auto max-w-md overflow-hidden py-12 px-4 sm:max-w-3xl sm:px-6 lg:max-w-7xl lg:px-8">
        <div className="mx-auto flex w-full items-center pb-4">
          <img
            aria-hidden="true"
            className="mx-auto"
            src="/img/white-logo.svg"
          ></img>
        </div>
        <nav
          className="-mx-5 -my-2 flex flex-wrap justify-center"
          aria-label="Footer"
        >
          {footerNavigation.main.map((item) => (
            <div key={item.name} className="px-5 py-2">
              <a
                href={item.href}
                className="text-base text-gray-400 hover:text-gray-300"
              >
                {item.name}
              </a>
            </div>
          ))}
        </nav>
        <p className="mt-8 text-center text-base text-gray-400">
          &copy; 2022 Mere Medical. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
