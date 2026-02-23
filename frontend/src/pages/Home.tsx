import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePricing } from '../hooks/usePricing';
import {
  ArrowRight,
  Phone,
  Leaf,
  Milk,
  Sparkles,
  Heart,
  CheckCircle,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Twitter,
} from 'lucide-react';

import heroBg from '../assets/Hero Background.png';
import product1l from '../assets/product-1l.jpg';
import product500ml from '../assets/product-500ml.jpg';
import commitmentImg from '../assets/commitment.jpg';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { daily1LRs, daily500mlRs } = usePricing();

  const scrollToProducts = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-[1200px]">
        <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-sm px-6 md:px-8 py-3 flex items-center justify-between">
          <img
            src="/logo.png"
            alt="Maa Ilay Logo"
            className="h-12 w-auto object-contain"
          />
          <div className="flex items-center gap-4">
            <a href="tel:+919876543210" className="hidden md:flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors">
              <Phone className="w-3.5 h-3.5" />
              Call Us
            </a>
            <button
              onClick={() => navigate('/customer/login')}
              className="px-5 py-2 bg-green-800 text-white rounded-lg text-sm font-medium hover:bg-green-900 transition-colors duration-200"
            >
              Subscribe / Login
            </button>
          </div>
        </div>
      </nav>

      <section className="relative h-screen flex items-end overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={heroBg}
            alt="Maa Ilay Fresh Milk"
            className="w-full h-full object-cover object-top"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"></div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-8 pb-24 md:pb-28 w-full">
          <div className="max-w-2xl">
            <p className="text-sm md:text-base font-medium text-white/80 tracking-widest uppercase mb-4 animate-fade-in-up">
              Farm Fresh &middot; Naturally Grown &middot; Delivered Daily
            </p>

            <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] text-white mb-5 animate-fade-in-up animation-delay-100">
              Fresh Milk<br />
              <span className="text-green-400">from Local Farms</span>
            </h1>

            <p className="text-lg md:text-xl text-white/90 leading-relaxed mb-8 max-w-lg animate-fade-in-up animation-delay-200">
              Naturally grown, traditionally prepared, delivered with care to your doorstep every morning.
            </p>

            <div className="flex flex-wrap gap-3 mb-10 animate-fade-in-up animation-delay-300">
              <button
                onClick={() => navigate('/customer/login')}
                className="group px-7 py-3 bg-green-800 text-white rounded-lg text-sm font-semibold hover:bg-green-900 transition-colors duration-200 flex items-center gap-2"
              >
                Start Subscription
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button
                onClick={scrollToProducts}
                className="px-7 py-3 border border-white/50 text-white rounded-lg text-sm font-semibold hover:bg-white/10 transition-colors duration-200"
              >
                Explore Our Products
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-white/80 text-sm animate-fade-in-up animation-delay-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-400" />
                100% Natural
              </span>
              <span className="flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-green-400" />
                Farm Fresh Daily
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-green-400" />
                Trusted by Families
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* What is Maa Ilay? */}
      <section className="py-20 bg-[#FFFBF5]">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-14">
            <div className="w-10 h-1 bg-green-800 mx-auto mb-4 rounded-full"></div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-5">What is Maa Ilay?</h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Maa Ilay brings naturally grown and traditionally prepared food from our own farms and trusted organic partners. Our mission is to support farmer livelihoods and empower rural women through meaningful employment and value-added products.
            </p>
          </div>

          <div className="grid md:grid-cols-4 grid-cols-1 gap-6 mt-12">
            {[
              {
                icon: Leaf,
                title: 'Naturally Grown & Collected',
                description: 'Our products come from farms that practice natural, chemical-free farming methods.',
              },
              {
                icon: Milk,
                title: 'A2 Quality Milk',
                description: 'Sourced from indigenous cows, our A2 milk contains only A2 beta-casein protein, making it easier to digest and naturally richer in nutrients.',
              },
              {
                icon: Sparkles,
                title: 'Traditionally Prepared',
                description: 'Time-tested traditional methods ensure authentic taste and nutritional value.',
              },
              {
                icon: Heart,
                title: 'Wholesome Experience',
                description: 'From farm to table, we ensure quality, freshness, and care in every delivery.',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex items-center gap-3 mb-3 md:block">
                  <div className="w-11 h-11 bg-green-800 rounded-full flex items-center justify-center flex-shrink-0 md:mb-5">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 md:mb-2">{item.title}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-14">
            <div className="w-10 h-1 bg-green-800 mx-auto mb-4 rounded-full"></div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Our Products</h2>
            <p className="text-base text-gray-500">Fresh, pure cow milk delivered daily to your doorstep</p>
          </div>

          <div className="grid md:grid-cols-2 grid-cols-1 gap-8 max-w-3xl mx-auto">
            {[
              {
                name: 'Fresh Cow Milk (1L)',
                benefit: 'Perfect for families. Pure, fresh milk delivered every morning.',
                price: `₹${daily1LRs}/day`,
                image: product1l,
                popular: true,
              },
              {
                name: 'Fresh Cow Milk (500ml)',
                benefit: 'Ideal for individuals. Fresh, pure milk in a convenient size for daily consumption.',
                price: `₹${daily500mlRs}/day`,
                image: product500ml,
                popular: false,
              },
            ].map((product, index) => (
              <div
                key={index}
                className="relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                {product.popular && (
                  <div className="absolute top-3 right-3 bg-green-800 text-white px-2.5 py-0.5 rounded-full text-xs font-semibold z-10">
                    Popular
                  </div>
                )}
                <div className="w-full h-72 bg-gray-50 overflow-hidden p-4">
                  <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{product.benefit}</p>
                  <p className="text-2xl font-bold text-green-800 mb-5">{product.price}</p>
                  <button
                    onClick={() => navigate('/customer/login')}
                    className="w-full py-3 bg-green-800 text-white rounded-lg text-sm font-semibold hover:bg-green-900 transition-colors duration-200"
                  >
                    Subscribe Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Commitment */}
      <section className="py-20 bg-[#FFFBF5]">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="grid lg:grid-cols-2 grid-cols-1 gap-14 items-center">
            <div className="rounded-xl overflow-hidden shadow-md">
              <img
                src={commitmentImg}
                alt="Our Commitment"
                className="w-full aspect-[4/3] object-cover"
              />
            </div>

            <div>
              <div className="w-10 h-1 bg-green-800 mb-4 rounded-full"></div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">Our Commitment</h2>
              <div className="space-y-5">
                {[
                  {
                    icon: Leaf,
                    title: 'Natural Farming Practices',
                    description: 'We use only natural, chemical-free farming methods to grow our produce.',
                  },
                  {
                    icon: Heart,
                    title: 'Empowering Women Farmers',
                    description: 'We create meaningful employment opportunities for rural women in our community.',
                  },
                  {
                    icon: MapPin,
                    title: 'Direct from Farm',
                    description: 'No middlemen. Fresh products delivered directly from our farms to your home.',
                  },
                  {
                    icon: CheckCircle,
                    title: 'Home Grown Brand',
                    description: 'A local brand built on trust, transparency, and traditional values.',
                  },
                ].map((item, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-green-800" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-green-800">
        <div className="max-w-[1400px] mx-auto px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to Experience Fresh, Pure Milk?</h2>
          <p className="text-base text-green-100 max-w-2xl mx-auto mb-8">
            Join hundreds of families in Pondicherry & Auroville enjoying farm-fresh milk every morning.
          </p>
          <button
            onClick={() => navigate('/customer/login')}
            className="inline-flex items-center gap-2 bg-white text-green-800 px-8 py-3 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors duration-200"
          >
            Start Your Subscription
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="grid md:grid-cols-4 grid-cols-1 gap-10 mb-10">
            <div>
              <div className="mb-4">
                <img
                  src="/logo.png"
                  alt="Maa Ilay Logo"
                  className="h-14 w-auto object-contain brightness-0 invert"
                />
              </div>
              <p className="text-gray-300 leading-relaxed text-sm">
                Fresh milk for healthy lives. Naturally grown, traditionally prepared, delivered with care.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4">Quick Links</h3>
              <div className="space-y-2">
                {['About Us', 'Products', 'Contact', 'Privacy Policy', 'Terms of Service'].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="block text-sm text-gray-300 hover:text-green-400 transition-colors duration-200"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4">Contact Us</h3>
              <div className="space-y-3">
                <div className="flex gap-2 text-gray-300 text-sm">
                  <Phone className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="flex gap-2 text-gray-300 text-sm">
                  <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>hello@maailay.com</span>
                </div>
                <div className="flex gap-2 text-gray-300 text-sm">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Pondicherry & Auroville</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4">Follow Us</h3>
              <div className="flex gap-4">
                {[Facebook, Instagram, Twitter].map((Icon, index) => (
                  <a
                    key={index}
                    href="#"
                    className="text-gray-300 hover:text-green-400 transition-colors duration-200"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 text-center">
            <p className="text-xs text-gray-400">&copy; 2025 Maa Ilay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
