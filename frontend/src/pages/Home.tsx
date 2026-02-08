import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PRICING } from '../config/pricing';
import {
  Droplet,
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

import heroBg from '../assets/hero-background-new.png';
import product1l from '../assets/product-1l.jpg';
import product500ml from '../assets/product-500ml.jpg';
import commitmentImg from '../assets/commitment.jpg';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  const scrollToProducts = () => {
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-[1350px] bg-white/80 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-full transition-all duration-300">
        <div className="px-8 md:px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full shadow-lg flex items-center justify-center">
              <Droplet className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Maa Ilay</span>
          </div>

          <div className="flex items-center gap-3">
            <button className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-emerald-600 transition-colors">
              <Phone className="w-4 h-4" />
              Call Us
            </button>
            <button
              onClick={() => navigate('/customer/login')}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              Subscribe / Login
            </button>
          </div>
        </div>
      </nav>

      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background Image - Clean and Crisp */}
        <div className="absolute inset-0 z-0">
          <img
            src={heroBg}
            alt="Maa Ilay Fresh Milk"
            className="w-full h-full object-cover object-top"
          />
        </div>
        {/* Background Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/300 to-black/10"></div>

        {/* Content Container */}
        <div className="relative z-10 max-w-[1400px] mx-auto px-8 py-32 pt-48 w-full">
          <div className="max-w-3xl">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full px-5 py-2.5 shadow-2xl mb-6 animate-fade-in-up">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                🌾 Farm Fresh • Naturally Grown • Delivered Daily
              </span>
            </div>

            {/* Main Heading with Enhanced Brightness */}
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6 animate-fade-in-up animation-delay-100">
              <span className="block text-white drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]">
                Fresh Milk
              </span>
              <span className="block bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] mt-1">
                from Local Farms
              </span>
            </h1>

            {/* Subtitle with Enhanced Glassmorphism for legibility */}
            <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-2xl p-6 mb-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] animate-fade-in-up animation-delay-200">
              <p className="text-xl text-white font-semibold leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                Naturally grown, traditionally prepared, delivered with care to your doorstep every morning.
                <span className="block mt-2 text-emerald-300 font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
                  Pure. Fresh. Wholesome.
                </span>
              </p>
            </div>

            {/* CTA Buttons with Premium Effects */}
            <div className="flex flex-wrap gap-4 animate-fade-in-up animation-delay-300">
              <button
                onClick={() => navigate('/customer/login')}
                className="group px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-base font-semibold hover:shadow-2xl hover:scale-105 transition-all duration-300 flex items-center gap-2"
              >
                Start Subscription
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={scrollToProducts}
                className="group px-8 py-3.5 bg-white/10 backdrop-blur-xl border-2 border-white/30 text-white rounded-xl text-base font-semibold hover:bg-white/20 hover:border-white/50 hover:scale-105 shadow-2xl transition-all duration-300"
              >
                <span className="flex items-center gap-2">
                  Explore Our Products
                  <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                </span>
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 flex flex-wrap items-center gap-6 animate-fade-in-up animation-delay-400">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">100% Natural</p>
                  <p className="text-white/70 text-xs">No chemicals</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-teal-500/20 backdrop-blur-sm border border-teal-400/30 rounded-lg flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Farm Fresh</p>
                  <p className="text-white/70 text-xs">Daily delivery</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-cyan-500/20 backdrop-blur-sm border border-cyan-400/30 rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Pure Quality</p>
                  <p className="text-white/70 text-xs">Trusted by families</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-32 bg-white">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-20 animate-fade-in-up">
            <h2 className="text-5xl font-bold text-gray-900 mb-6">What is Maa Ilay?</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Maa Ilay brings naturally grown and traditionally prepared food from our own farms and trusted organic partners. Our mission is to support farmer livelihoods and empower rural women through meaningful employment and value-added products.
            </p>
          </div>

          <div className="grid md:grid-cols-4 grid-cols-1 gap-8 mt-16">
            {[
              {
                icon: Leaf,
                title: 'Naturally Grown & Collected',
                description: 'Our products come from farms that practice natural, chemical-free farming methods.',
                gradient: 'from-emerald-600 to-green-500',
              },
              {
                icon: Milk,
                title: 'A2 Quality Milk',
                description: 'Sourced from indigenous cows, our A2 milk contains only A2 beta-casein protein, making it easier to digest and naturally richer in nutrients.',
                gradient: 'from-green-500 to-emerald-600',
              },
              {
                icon: Sparkles,
                title: 'Traditionally Prepared',
                description: 'Time-tested traditional methods ensure authentic taste and nutritional value.',
                gradient: 'from-green-500 to-emerald-600',
              },
              {
                icon: Heart,
                title: 'Wholesome Experience',
                description: 'From farm to table, we ensure quality, freshness, and care in every delivery.',
                gradient: 'from-emerald-600 to-green-500',
              },
            ].map((item, index) => (
              <div
                key={index}
                className="group p-8 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300"
              >
                <div className={`w-16 h-16 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                  <item.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="products" className="py-32 bg-gradient-to-br from-white via-emerald-50 to-white">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-gray-900 mb-4">Our Products</h2>
            <p className="text-lg text-gray-600">Fresh, pure cow milk delivered daily to your doorstep</p>
          </div>

          <div className="grid md:grid-cols-2 grid-cols-1 gap-12 max-w-3xl mx-auto">
            {/**/}
            {[
              {
                name: 'Fresh Cow Milk (1L)',
                benefit: 'Perfect for families. Pure, fresh milk delivered every morning.',
                price: `₹${PRICING.DAILY_1L_RS}/day`,
                image: product1l,
                popular: true,
              },
              {
                name: 'Fresh Cow Milk (500ml)',
                benefit: 'Ideal for individuals. Fresh, pure milk in a convenient size for daily consumption.',
                price: `₹${PRICING.DAILY_500ML_RS}/day`,
                image: product500ml,
                popular: false,
              },
            ].map((product, index) => (
              <div
                key={index}
                className="relative bg-white border-2 border-gray-200 rounded-3xl p-8 shadow-lg hover:shadow-2xl hover:-translate-y-2 hover:border-emerald-300 transition-all duration-300"
              >
                {product.popular && (
                  <div className="absolute -top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                    Popular
                  </div>
                )}
                <div className="w-full h-64 rounded-2xl overflow-hidden mb-6">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">{product.name}</h3>
                <p className="text-gray-600 leading-relaxed mb-6">{product.benefit}</p>
                <p className="text-3xl font-bold text-emerald-600 mb-6">{product.price}</p>
                <button
                  onClick={() => navigate('/customer/login')}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-lg font-semibold shadow-md hover:scale-105 hover:shadow-xl transition-all duration-300"
                >
                  Subscribe Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 bg-white">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="grid lg:grid-cols-2 grid-cols-1 gap-16 items-center">
            <div className="rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.02]">
              <img
                src={commitmentImg}
                alt="Our Commitment"
                className="w-full aspect-[4/3] object-cover"
              />
            </div>

            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-8">Our Commitment</h2>
              <div className="space-y-6">
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
                  <div key={index} className="flex gap-4 items-start animate-fade-in">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{item.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-emerald-500 to-emerald-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
        </div>

        <div className="max-w-[1400px] mx-auto px-8 text-center relative z-10">
          <h2 className="text-5xl font-bold text-white mb-6">Ready to Experience Fresh, Pure Milk?</h2>
          <p className="text-xl text-emerald-100 max-w-2xl mx-auto mb-10">
            Join hundreds of families in Pondicherry & Auroville enjoying farm-fresh milk every morning.
          </p>
          <button
            onClick={() => navigate('/customer/login')}
            className="inline-flex items-center gap-2 bg-white text-emerald-600 px-12 py-5 rounded-xl text-xl font-bold shadow-2xl hover:scale-105 hover:shadow-3xl transition-all duration-300"
          >
            Start Your Subscription
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-[1400px] mx-auto px-8">
          <div className="grid md:grid-cols-4 grid-cols-1 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                  <Droplet className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold">Maa Ilay</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Fresh milk for healthy lives. Naturally grown, traditionally prepared, delivered with care.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
              <div className="space-y-2">
                {['About Us', 'Products', 'Contact', 'Privacy Policy', 'Terms of Service'].map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="block text-gray-400 hover:text-emerald-400 transition-colors duration-200"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
              <div className="space-y-3">
                <div className="flex gap-2 text-gray-400">
                  <Phone className="w-5 h-5 flex-shrink-0" />
                  <span>+91 98765 43210</span>
                </div>
                <div className="flex gap-2 text-gray-400">
                  <Mail className="w-5 h-5 flex-shrink-0" />
                  <span>hello@maailay.com</span>
                </div>
                <div className="flex gap-2 text-gray-400">
                  <MapPin className="w-5 h-5 flex-shrink-0" />
                  <span>Pondicherry & Auroville</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Follow Us</h3>
              <div className="flex gap-4">
                {[Facebook, Instagram, Twitter].map((Icon, index) => (
                  <a
                    key={index}
                    href="#"
                    className="text-gray-400 hover:text-emerald-400 hover:scale-110 transition-all duration-200"
                  >
                    <Icon className="w-6 h-6" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-sm text-gray-500">© 2024 Maa Ilay. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
