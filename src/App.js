import React, { useState, useEffect } from 'react';
import { Users, Sword, Shield, Trophy, Plus, Edit, Save, Trash2, Eye, EyeOff, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';

const CrusadeCampaignApp = () => {
  // Auth state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState('login');
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  // App data states
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [crusadeForces, setCrusadeForces] = useState([]);
  const [units, setUnits] = useState([]);
  
  // Modal states
  const [editingForce, setEditingForce] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: '', description: '' });

  // Available factions organized by allegiance
  const factions = {
    Imperium: [
      'Adeptus Custodes',
      'Adeptus Mechanicus', 
      'Astra Militarum',
      'Deathwatch',
      'Grey Knights',
      'Imperial Knights',
      'Sisters of Battle',
      'Space Marines'
    ],
    Chaos: [
      'Chaos Daemons',
      'Chaos Space Marines',
      'Death Guard',
      'Thousand Sons'
    ],
    Xenos: [
      'Aeldari',
      'Drukhari',
      'Harlequins',
      'Necrons',
      'Orks',
      'Tau Empire',
      'Tyranids'
    ]
  };

  // Initialize auth state
  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) {
        setCurrentView('dashboard');
        loadUserData();
      } else {
        setCurrentView('login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        setCurrentView('dashboard');
        loadUserData();
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  const loadUserData = async () => {
    if (!user) return;
    
    try {
      // Load campaigns with simplified member data
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_members (
            user_id,
            faction,
            username
          )
        `);

      if (campaignError) throw campaignError;
      setCampaigns(campaignData || []);

      // Rest of the function stays the same...
      const { data: forceData, error: forceError } = await supabase
        .from('crusade_forces')
        .select('*');

      if (forceError) throw forceError;
      setCrusadeForces(forceData || []);

      const { data: unitData, error: unitError } = await supabase
        .from('units')
        .select('*');

      if (unitError) throw unitError;
      setUnits(unitData || []);

    } catch (error) {
      console.error('Error loading data:', error);
    }
  };  

  // Authentication functions
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      alert('Please enter email and password');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password
      });

      if (error) throw error;
      
      setLoginForm({ email: '', password: '' });
    } catch (error) {
      alert('Error logging in: ' + error.message);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.username || !registerForm.email || !registerForm.password || !registerForm.confirmPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: registerForm.email,
        password: registerForm.password,
        options: {
          data: {
            username: registerForm.username
          }
        }
      });

      if (error) throw error;
      
      alert('Registration successful! Please check your email for verification.');
      setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' });
      setCurrentView('login');
    } catch (error) {
      alert('Error registering: ' + error.message);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setCurrentView('login');
      setSelectedCampaign(null);
      setCampaigns([]);
      setCrusadeForces([]);
      setUnits([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Campaign functions
  const createCampaign = async () => {
  if (!campaignForm.name || !campaignForm.description) {
    alert('Please fill in campaign name and description');
    return;
  }

  try {
    const { data, error } = await supabase
      .from('campaigns')
      .insert([{
        name: campaignForm.name,
        description: campaignForm.description,
        admin_id: user.id
      }])
      .select();

    if (error) throw error;

    // Add creator as member with username
    await supabase
      .from('campaign_members')
      .insert([{
        campaign_id: data[0].id,
        user_id: user.id,
        faction: 'Space Marines',
        username: user.user_metadata?.username || user.email.split('@')[0]
      }]);

    setCampaignForm({ name: '', description: '' });
    setCreatingCampaign(false);
    loadUserData(); // Refresh data
  } catch (error) {
    alert('Error creating campaign: ' + error.message);
  }
};

  const joinCampaign = async (campaignId, faction) => {
  try {
    const { error } = await supabase
      .from('campaign_members')
      .insert([{
        campaign_id: campaignId,
        user_id: user.id,
        faction,
        username: user.user_metadata?.username || user.email.split('@')[0]
      }]);

    if (error) throw error;
    loadUserData(); // Refresh data
  } catch (error) {
    alert('Error joining campaign: ' + error.message);
  }
};

  const deleteCampaign = async (campaignId) => {
    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error deleting campaign: ' + error.message);
    }
  };

  // Crusade Force functions
  const saveCrusadeForce = async (force) => {
    try {
      if (editingForce && editingForce.id) {
        // Update existing force
        const { error } = await supabase
          .from('crusade_forces')
          .update(force)
          .eq('id', editingForce.id);

        if (error) throw error;
      } else {
        // Create new force
        const { error } = await supabase
          .from('crusade_forces')
          .insert([{
            ...force,
            campaign_id: selectedCampaign.id,
            user_id: user.id
          }]);

        if (error) throw error;
      }

      setEditingForce(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error saving force: ' + error.message);
    }
  };

  const requestDeleteCrusadeForce = (force) => {
    setConfirmDelete({ type: 'force', id: force.id, name: force.name });
  };

  const deleteCrusadeForce = async (forceId) => {
    try {
      const { error } = await supabase
        .from('crusade_forces')
        .delete()
        .eq('id', forceId);

      if (error) throw error;

      setConfirmDelete(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error deleting force: ' + error.message);
    }
  };

  // Unit functions
  const saveUnit = async (unit) => {
    try {
      if (editingUnit && editingUnit.id) {
        // Update existing unit
        const { error } = await supabase
          .from('units')
          .update(unit)
          .eq('id', editingUnit.id);

        if (error) throw error;
      } else {
        // Create new unit
        const { error } = await supabase
          .from('units')
          .insert([{
            ...unit,
            crusade_force_id: editingUnit.crusadeForceId
          }]);

        if (error) throw error;
      }

      setEditingUnit(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error saving unit: ' + error.message);
    }
  };

  const requestDeleteUnit = (unit) => {
    setConfirmDelete({ type: 'unit', id: unit.id, name: unit.name });
  };

  const deleteUnit = async (unitId) => {
    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unitId);

      if (error) throw error;

      setConfirmDelete(null);
      loadUserData(); // Refresh data
    } catch (error) {
      alert('Error deleting unit: ' + error.message);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-400 mx-auto mb-4"></div>
          <p className="text-xl">Loading Crusade Data...</p>
        </div>
      </div>
    );
  }

  // Login/Register View
  if (currentView === 'login' || currentView === 'register') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4 text-red-400">⚔️ Crusade Campaign Manager</h1>
            <p className="text-gray-300">Track your Warhammer 40k Crusade forces and campaigns</p>
            <p className="text-sm text-yellow-400 mt-2">Powered by Supabase - Real-time multiplayer!</p>
          </div>
          
          <div className="max-w-md mx-auto bg-gray-800 rounded-lg p-6 shadow-lg">
            <div className="flex mb-6">
              <button 
                onClick={() => setCurrentView('login')}
                className={`flex-1 py-2 px-4 rounded-l-lg ${currentView === 'login' ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setCurrentView('register')}
                className={`flex-1 py-2 px-4 rounded-r-lg ${currentView === 'register' ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                Register
              </button>
            </div>

            {currentView === 'login' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500 pr-10"
                      onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg font-medium">
                  Login
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <button onClick={handleRegister} className="w-full bg-red-600 hover:bg-red-700 py-2 px-4 rounded-lg font-medium">
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Dashboard
  if (currentView === 'dashboard') {
    const userCampaigns = campaigns.filter(c => 
      c.campaign_members?.some(m => m.user_id === user.id) || c.admin_id === user.id
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white">
        <nav className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-red-400">⚔️ Crusade Campaign Manager</h1>
            <div className="flex items-center space-x-4">
              <span>Welcome, {user.user_metadata?.username || user.email}</span>
              <button onClick={logout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center">
                <LogOut className="mr-2" size={16} />
                Logout
              </button>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <button 
              onClick={() => setCreatingCampaign(true)}
              className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-medium flex items-center"
            >
              <Plus className="mr-2" size={20} />
              Create New Campaign
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Users className="mr-2" /> Your Campaigns
              </h2>
              {userCampaigns.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No campaigns yet. Create your first campaign!</p>
              ) : (
                userCampaigns.map(campaign => {
                  const isAdmin = campaign.admin_id === user.id;
                  const isMember = campaign.campaign_members?.some(m => m.user_id === user.id);
                  
                  return (
                    <div key={campaign.id} className="border border-gray-600 rounded-lg p-4 mb-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-lg flex items-center">
                            {campaign.name}
                            {isAdmin && <span className="ml-2 text-xs bg-yellow-600 px-2 py-1 rounded">ADMIN</span>}
                          </h3>
                          <p className="text-gray-300">{campaign.description}</p>
                        </div>
                        {isAdmin && (
                          <button 
                            onClick={() => deleteCampaign(campaign.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete Campaign"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-gray-400 mb-2">
                          Members ({campaign.campaign_members?.length || 0}):
                        </p>
                        {campaign.campaign_members?.length > 0 ? (
                          <div className="space-y-1">
                            {campaign.campaign_members.map((member, index) => (
                              <div key={`${member.user_id}-${index}`} className="flex justify-between items-center text-sm bg-gray-700 rounded px-3 py-1">
                                <span>{member.username || 'Unknown'} ({member.faction})</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No members yet</p>
                        )}
                      </div>
                      
                      {isMember ? (
                        <button 
                          onClick={() => {
                            setSelectedCampaign(campaign);
                            setCurrentView('campaign');
                          }}
                          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
                        >
                          Enter Campaign
                        </button>
                      ) : (
                        <div className="flex space-x-2">
                          <select 
                            id={`faction-${campaign.id}`}
                            className="flex-1 bg-gray-700 rounded-lg px-3 py-2"
                            defaultValue=""
                          >
                            <option value="" disabled>Select Faction</option>
                            <optgroup label="🛡️ Imperium">
                              {factions.Imperium.map(faction => (
                                <option key={faction} value={faction}>{faction}</option>
                              ))}
                            </optgroup>
                            <optgroup label="⚡ Chaos">
                              {factions.Chaos.map(faction => (
                                <option key={faction} value={faction}>{faction}</option>
                              ))}
                            </optgroup>
                            <optgroup label="👽 Xenos">
                              {factions.Xenos.map(faction => (
                                <option key={faction} value={faction}>{faction}</option>
                              ))}
                            </optgroup>
                          </select>
                          <button 
                            onClick={() => {
                              const faction = document.getElementById(`faction-${campaign.id}`).value;
                              if (faction) {
                                joinCampaign(campaign.id, faction);
                              }
                            }}
                            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
                          >
                            Join
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <Trophy className="mr-2" /> Your Stats
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Campaigns Created</span>
                  <span className="font-bold text-yellow-400">
                    {campaigns.filter(c => c.admin_id === user.id).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Campaigns Joined</span>
                  <span className="font-bold text-green-400">
                    {userCampaigns.length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Total Crusade Forces</span>
                  <span className="font-bold text-red-400">
                    {crusadeForces.filter(f => f.user_id === user.id).length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
                  <span>Total Units</span>
                  <span className="font-bold text-blue-400">
                    {units.filter(u => {
                      const force = crusadeForces.find(f => f.id === u.crusade_force_id);
                      return force && force.user_id === user.id;
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign Creation Modal */}
          {creatingCampaign && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-green-400 flex items-center">
                  <Plus className="mr-2" size={20} />
                  Create New Campaign
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Campaign Name</label>
                    <input
                      type="text"
                      value={campaignForm.name}
                      onChange={(e) => setCampaignForm({...campaignForm, name: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="The Great Crusade"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={campaignForm.description}
                      onChange={(e) => setCampaignForm({...campaignForm, description: e.target.value})}
                      className="w-full px-3 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-green-500 h-24"
                      placeholder="A campaign of epic battles across the galaxy..."
                    />
                  </div>
                </div>
                <div className="flex space-x-4 pt-4 mt-6 border-t border-gray-600">
                  <button 
                    onClick={createCampaign}
                    className="flex-1 bg-green-600 hover:bg-green-700 py-2 px-4 rounded-lg font-medium flex items-center justify-center"
                  >
                    <Save className="mr-2" size={16} />
                    Create Campaign
                  </button>
                  <button 
                    onClick={() => {
                      setCreatingCampaign(false);
                      setCampaignForm({ name: '', description: '' });
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Campaign View (simplified for initial setup)
  if (currentView === 'campaign' && selectedCampaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-gray-900 to-black text-white">
        <nav className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="container mx-auto flex justify-between items-center">
            <div>
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="text-red-400 hover:text-red-300 mr-4"
              >
                ← Back
              </button>
              <span className="text-2xl font-bold">{selectedCampaign.name}</span>
            </div>
          </div>
        </nav>

        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <Sword className="mx-auto mb-4 text-gray-500" size={64} />
            <p className="text-xl text-gray-400 mb-4">Campaign View Coming Soon!</p>
            <p className="text-gray-500">Force and unit management will be added in the next update.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default CrusadeCampaignApp;