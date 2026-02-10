import React, { useState, useEffect } from 'react';
import { CustomerLayout } from '../../components/layouts/CustomerLayout';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Phone, Mail, MessageSquare, ChevronDown, Truck } from 'lucide-react';
import { getApiUrl } from '../../config/api';

type DeliveryPersonInfo = { name: string; phone: string } | null;

export const Support: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [deliveryPerson, setDeliveryPerson] = useState<DeliveryPersonInfo>(null);

  useEffect(() => {
    fetch(getApiUrl('/api/customer/dashboard'), { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        setDeliveryPerson(data.customer?.deliveryPerson || null);
      })
      .catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    priority: 'medium',
  });

  const faqs = [
    {
      question: 'How do I pause my subscription?',
      answer:
        'Go to the Calendar page and click on the dates you want to pause delivery. Changes must be made before 5 PM the previous day.',
    },
    {
      question: 'What is the cutoff time for changes?',
      answer:
        'All changes to your delivery (pause, quantity changes) must be made before 5 PM the previous day.',
    },
    {
      question: 'How do bottle deposits work?',
      answer:
        'A bottle deposit of ₹35 (1L) or ₹25 (500ml) is charged every 3 months. This is refundable when you return the bottles.',
    },
    {
      question: 'Can I change my daily quantity?',
      answer:
        'Yes! You can change your daily quantity from the Subscription page. The changes will take effect from the next billing cycle.',
    },
    {
      question: 'What if I have negative balance?',
      answer:
        'You have a 1-day grace period for negative balance. Please top up your wallet to avoid delivery interruption.',
    },
  ];

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Support</h1>
          <p className="text-gray-600">Get help and contact us</p>
        </div>

        <div className="grid lg:grid-cols-2 grid-cols-1 gap-8">
          <div>
            <Card variant="gradient" className="p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Us</h2>

              <div className="space-y-4">
                {[
                  {
                    icon: Phone,
                    label: 'Call Us',
                    value: '+91 98765 43210',
                    subtext: 'Mon-Sat, 8 AM - 8 PM',
                  },
                  {
                    icon: Mail,
                    label: 'Email Us',
                    value: 'support@maailay.com',
                    subtext: 'We reply within 24 hours',
                  },
                  {
                    icon: MessageSquare,
                    label: 'WhatsApp',
                    value: '+91 98765 43210',
                    subtext: 'Quick support',
                  },
                ...(deliveryPerson
                  ? [
                      {
                        icon: Truck,
                        label: 'Delivery Person',
                        value: deliveryPerson.name,
                        subtext: deliveryPerson.phone,
                      },
                    ]
                  : []),
                ].map((contact, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <contact.icon className="w-6 h-6 text-green-800" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">{contact.label}</p>
                        <p className="text-gray-900 font-medium">{contact.value}</p>
                        <p className="text-sm text-gray-500 mt-1">{contact.subtext}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div>
            <Card className="p-8 mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Frequently Asked Questions
              </h2>

              <div className="space-y-3">
                {faqs.map((faq, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setOpenFaq(openFaq === index ? null : index)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <span className="font-semibold text-gray-900 text-left">{faq.question}</span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 transition-transform ${
                          openFaq === index ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openFaq === index && (
                      <div className="px-4 pb-4 text-gray-600 leading-relaxed">{faq.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Raise a Request</h2>

              <form className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors outline-none"
                  >
                    <option value="">Select subject</option>
                    <option value="delivery">Delivery Issue</option>
                    <option value="billing">Billing Issue</option>
                    <option value="bottle">Bottle Issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={5}
                    placeholder="Describe your issue..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-colors outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <div className="flex gap-4">
                    {['low', 'medium', 'high'].map((priority) => (
                      <label key={priority} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priority"
                          value={priority}
                          checked={formData.priority === priority}
                          onChange={(e) =>
                            setFormData({ ...formData, priority: e.target.value })
                          }
                          className="w-4 h-4 text-green-500"
                        />
                        <span className="capitalize">{priority}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button fullWidth>Submit Request</Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};
